import { summarizeFiles } from "./ai";
import { saveHashes } from "./hashes";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { promisify } from "util";
import glob from "glob";

import { loadSummarizationChain } from "langchain/chains";
import { PromptTemplate } from "langchain/prompts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { Prompts } from "./prompts";
import { Config, Hashes, Embeddable } from "./types";
import { getHashes, checkNoFilesChanged } from "./hashes";
import { readFile, writeFile, fileExists } from "./utils";
import {
  getConfig,
  loadPrompt,
  updateConfig,
  getAssistantsConfig,
  updateAssistants,
} from "./config";
import { embedJson, embedFile, getConfiguredEmbeddings } from "./embeddings";
import { summarizeFile, uploadToOpenAi, createAssistant } from "./ai";

import gitignoreToGlob from "gitignore-to-glob";
import { abort } from "process";
import { askGpt } from "./chat";

const OPENAI_KEY = process.env.OPENAI_KEY;
const embeddingModel = new OpenAIEmbeddings({ openAIApiKey: OPENAI_KEY });
const chatModel = new ChatOpenAI({
  temperature: 0,
  openAIApiKey: OPENAI_KEY,
  modelName: "gpt-4",
  maxRetries: 2,
});

export async function embed() {
  // load config
  const config = await getConfig();
  const ignorePattern = gitignoreToGlob().map((pattern) =>
    pattern.replace("!", "./")
  );

  // get all the files in .knowhow/docs
  for (const source of config.embedSources) {
    console.log("Embedding", source.input, "to", source.output);
    console.log("Ignoring", ignorePattern);
    const files = await glob.sync(source.input, { ignore: ignorePattern });
    console.log(`Found ${files.length} files`);
    if (files.length > 100) {
      console.error(
        "woah there, that's a lot of files. I'm not going to embed that many"
      );
    }
    console.log(files);
    for (const file of files) {
      await embedFile(file, source);
    }
  }
}

export async function upload() {
  const config = await getConfig();
  for (const source of config.embedSources) {
    const items = JSON.parse(await readFile(source.output, "utf8"));
    const [embedding_name] = path.basename(source.output).split(".");
    const data = {
      embedding_name,
      items,
    };

    console.log("Uploading", source.output, "to", embedding_name);
    let config = {
      method: "post",
      url: "https://sqi4o2vea57u2fdazbqqsvycwi0zjsyt.lambda-url.us-west-2.on.aws/agents/embeddings",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.AGENT_API_KEY,
      },
      data: data,
    };
    await axios.request(config);
  }
}

export async function uploadOpenAi() {
  const config = await getConfig();
  const assistantsConfig = await getAssistantsConfig();
  const ignorePattern = gitignoreToGlob().map((pattern) =>
    pattern.replace("!", "./")
  );

  for (const assistant of config.assistants) {
    if (!assistant.id) {
      const fileIds = [];
      for (const globPath of assistant.files) {
        const files = await glob.sync(globPath, { ignore: ignorePattern });
        for (const file of files) {
          if (!assistantsConfig.files[file]) {
            const uploaded = await uploadToOpenAi(file);
            assistantsConfig.files[file] = uploaded.id;
            await updateAssistants(assistantsConfig);
          }
          fileIds.push(assistantsConfig.files[file]);
        }
      }

      const toCreate = {
        ...assistant,
        files: fileIds,
      };
      const createdAssistant = await createAssistant(toCreate);
      assistant.id = createdAssistant.id;
      await updateConfig(config);
    }

    console.log(`Assistant ${assistant.id} is ready`);
  }
}

export async function generate() {
  // load config
  const config = await getConfig();

  // process each source
  for (const source of config.sources) {
    // read the configured prompt into memory
    const prompt = await loadPrompt(source.prompt);
    const files = glob.sync(source.input);

    if (source.output.endsWith(".mdx")) {
      await handleSingleOutputGeneration(files, prompt, source.output);
    } else {
      await handleMultiOutputGeneration(files, prompt, source.output);
    }
  }
}

export async function handleMultiOutputGeneration(
  files: Array<string>,
  prompt: string,
  output: string
) {
  // get the hash of the prompt
  const promptHash = crypto.createHash("md5").update(prompt).digest("hex");

  // get the files matching the input pattern
  const hashes = await getHashes();

  for (const file of files) {
    // get the hash of the file
    const fileContent = await readFile(file, "utf8");
    const fileHash = crypto.createHash("md5").update(fileContent).digest("hex");

    if (!hashes[file]) {
      hashes[file] = { promptHash: "", fileHash: "" };
    }

    if (
      hashes[file].promptHash === promptHash &&
      hashes[file].fileHash === fileHash
    ) {
      console.log("Skipping file", file, "because it hasn't changed");
      continue;
    }

    // summarize the file
    console.log("Summarizing", file);
    const summary = await summarizeFile(file, prompt);

    // write the summary to the output file
    const [fileName, fileExt] = path.basename(file).split(".");
    const outputFile = path.join(output, fileName + ".mdx");

    console.log("Writing summary to", outputFile);
    await writeFile(outputFile, summary);

    hashes[file] = { promptHash, fileHash };
    await saveHashes(hashes);
  }
}

export async function handleSingleOutputGeneration(
  files: Array<string>,
  prompt: string,
  outputFile: string
) {
  const hashes = await getHashes();
  const promptHash = crypto.createHash("md5").update(prompt).digest("hex");

  const noChanges = await checkNoFilesChanged(files, promptHash, hashes);
  if (noChanges) {
    console.log(`Skipping ${files.length} files because they haven't changed`);
    return;
  }

  console.log("Summarizing", files.length, "files");
  const summary = await summarizeFiles(files, prompt);
  const fileHash = crypto.createHash("md5").update(summary).digest("hex");

  console.log("Writing summary to", outputFile);
  await writeFile(outputFile, summary);
  hashes[outputFile] = { promptHash, fileHash };
  await saveHashes(hashes);
}

export async function chat() {
  const config = await getConfig();
  const embeddings = await getConfiguredEmbeddings();
  await askGpt("knowhow", embeddings, config.plugins);
}

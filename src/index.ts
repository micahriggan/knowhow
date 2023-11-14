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
import { getConfig, loadPrompt } from "./config";
import { embedJson } from "./embedJson";

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

  // get all the files in .knowhow/docs
  for (const source of config.embedSources) {
    const files = glob.sync(source.input);
    const prompt = source.prompt ? await loadPrompt(source.prompt) : "";

    const embeddings: Embeddable[] = await loadEmbedding(source.output);

    for (const file of files) {
      if (file.endsWith(".json")) {
        await embedJson(source);
        continue;
      }

      if (embeddings.find((e) => e.id === file)) {
        console.log("Skipping already embedded file", file);
        continue;
      }

      // get the content of the file
      const fileContent = await readFile(file, "utf8");
      let text = fileContent;

      // if there is a prompt, summarize the file
      if (prompt) {
        console.log("Summarizing", file);
        text = await summarizeTexts([text], prompt);
      }

      // generate the embedding
      //const embedding = await embeddingModel.embedQuery(text);

      // create the Embeddable object
      const embeddable: Embeddable = {
        id: file,
        text,
        metadata: {
          content: fileContent,
          filepath: file,
          date: new Date().toISOString(),
        },
      };

      embeddings.push(embeddable);
      await writeFile(source.output, JSON.stringify(embeddings, null, 2));
    }
  }
}

export async function loadEmbedding(path: string) {
  if (await fileExists(path)) {
    return JSON.parse(await readFile(path, "utf8")) as Embeddable[];
  }
  return [];
}

export async function summarizeTexts(texts: string[], template: string) {
  const prompt = new PromptTemplate({
    template,
    inputVariables: ["text"],
  });

  const summarizationChain = await loadSummarizationChain(chatModel, {
    prompt,
    type: "stuff",
  });

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
  });

  const docs = await textSplitter.createDocuments(texts);

  const result = await summarizationChain.call({
    input_documents: docs.slice(0, 5),
  });

  console.log("Summary", result.text);

  return result.text as string;
}

async function summarizeFiles(files: string[], template: string) {
  const texts = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    texts.push(text);
  }
  return summarizeTexts(texts, template);
}

async function summarizeFile(file: string, template: string) {
  return await summarizeFiles([file], template);
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
      url: "https://xgg4923dx7.execute-api.us-west-2.amazonaws.com/prod/agents/embeddings",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.AGENT_API_KEY,
      },
      data: data,
    };
    await axios.request(config);
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

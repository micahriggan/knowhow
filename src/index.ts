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
  getIgnorePattern,
} from "./config";
import {
  embedJson,
  embedKind,
  getConfiguredEmbeddings,
  pruneEmbedding,
  loadEmbedding,
  saveEmbedding,
  embedSource,
  getConfiguredEmbeddingMap,
} from "./embeddings";
import { summarizeFile, uploadToOpenAi, createAssistant } from "./ai";

import { abort } from "process";
import { chatLoop } from "./chat";
import { convertToText } from "./conversion";
import { Plugins } from "./plugins/plugins";
import { AwsS3 } from "./services/S3";

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
  const ignorePattern = await getIgnorePattern();

  for (const source of config.embedSources) {
    await embedSource(source, ignorePattern);
  }
}

export async function purge(filePath: string) {
  const embeddings = await getConfiguredEmbeddingMap();
  const config = await getConfig();
  const chunkSizes = config.embedSources.reduce((acc, source) => {
    acc[source.output] = source.chunkSize;
    return acc;
  }, {});

  for (const file of Object.keys(embeddings)) {
    const pruned = embeddings[file]
      .filter((e) => !filePath || !e.id.startsWith(filePath))
      .filter((e) => e.text.length <= chunkSizes[file]);
    await saveEmbedding(file, pruned);
  }
}

export async function upload() {
  const config = await getConfig();

  for (const source of config.embedSources) {
    const bucketName = source.s3Bucket;

    if (!bucketName) {
      console.log("Skipping", source.output, "because no bucket is configured");
      continue;
    }
    const items = JSON.parse(await readFile(source.output, "utf8"));
    const { name: embeddingName } = path.parse(source.output);
    const data = {
      embeddingName,
      items,
    };

    console.log(
      "Uploading",
      source.output,
      "to",
      `${bucketName}/${embeddingName}.json`
    );

    const s3Key = `${embeddingName}.json`;
    await AwsS3.uploadFile(source.output, bucketName, s3Key);
  }
}

export async function uploadOpenAi() {
  const config = await getConfig();
  const ignorePattern = await getIgnorePattern();
  const assistantsConfig = await getAssistantsConfig();
  for (const assistant of config.assistants) {
    if (!assistant.model) {
      // Skip non openai assistants
      continue;
    }
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
  const config = await getConfig();
  for (const source of config.sources) {
    console.log("Generating", source.input, "to", source.output);
    await handleAllKindsGeneration(source);
  }
}

async function handleAllKindsGeneration(source: Config["sources"][0]) {
  const { kind, input } = source;
  if (Plugins.isPlugin(kind)) {
    const data = await Plugins.call(kind, input);
    if (source.output.endsWith("/")) {
      throw new Error("Plugins can only output to a single file");
    }
    await writeFile(source.output, data);
  }
  return handleFileKindGeneration(source);
}

async function handleFileKindGeneration(source: Config["sources"][0]) {
  const prompt = await loadPrompt(source.prompt);
  const files = glob.sync(source.input);
  console.log("Analyzing files: ", files);

  if (source.output.endsWith("/")) {
    await handleMultiOutputGeneration(
      source.input,
      files,
      prompt,
      source.output,
      source.kind
    );
  } else {
    await handleSingleOutputGeneration(
      files,
      prompt,
      source.output,
      source.kind
    );
  }
}
export async function handleMultiOutputGeneration(
  inputPattern: string,
  files: string[],
  prompt: string,
  output: string,
  kind?: string
) {
  // get the hash of the prompt
  const promptHash = crypto.createHash("md5").update(prompt).digest("hex");

  // get the files matching the input pattern
  const hashes = await getHashes();

  const inputPath = inputPattern.includes("**")
    ? inputPattern.split("**")[0]
    : "";

  for (const file of files) {
    // get the hash of the file
    const fileContent = await convertToText(file);
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
    const summary = prompt ? await summarizeFile(file, prompt) : fileContent;

    // write the summary to the output file
    const { name, ext, dir } = path.parse(file);
    const nestedFolder = inputPath ? (dir + "/").replace(inputPath, "") : "";
    console.log({ dir, inputPath, nestedFolder });
    const outputFolder = path.join(output, nestedFolder);

    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    const outputFile = path.join(outputFolder, name + ".mdx");

    console.log("Writing summary to", outputFile);
    await writeFile(outputFile, summary);

    hashes[file] = { promptHash, fileHash };
    await saveHashes(hashes);
  }
}

export async function handleSingleOutputGeneration(
  files: string[],
  prompt: string,
  outputFile: string,
  kind: string
) {
  const hashes = await getHashes();
  const promptHash = crypto.createHash("md5").update(prompt).digest("hex");

  const noChanges = await checkNoFilesChanged(files, promptHash, hashes);
  if (noChanges) {
    console.log(`Skipping ${files.length} files because they haven't changed`);
    return;
  }

  console.log("Summarizing", files.length, "files");
  const summary = prompt
    ? await summarizeFiles(files, prompt)
    : (await Promise.all(files.map(convertToText))).join("\n\n");

  const fileHash = crypto.createHash("md5").update(summary).digest("hex");

  console.log("Writing summary to", outputFile);
  await writeFile(outputFile, summary);
  hashes[outputFile] = { promptHash, fileHash };
  await saveHashes(hashes);
}

export async function chat() {
  const config = await getConfig();
  const embeddings = await getConfiguredEmbeddings();
  await chatLoop("knowhow", embeddings, config.plugins);
}

export async function download() {
  const config = await getConfig();

  for (const source of config.embedSources) {
    const bucketName = source.s3Bucket;

    if (!bucketName) {
      console.log("Skipping", source.output, "because no bucket is configured");
      continue;
    }
    const { name } = path.parse(source.output);
    const s3Key = `${name}.json`;
    const destinationPath = source.output;

    console.log(
      "Downloading",
      s3Key,
      "from",
      bucketName,
      "to",
      destinationPath
    );

    await AwsS3.downloadFile(bucketName, s3Key, destinationPath);
  }
}

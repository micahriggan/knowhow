import { summarizeFiles } from "./ai";
import { saveAllFileHashes, saveHashes } from "./hashes";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { promisify } from "util";
import glob from "glob";

import { Prompts } from "./prompts";
import { Config, Hashes, Embeddable } from "./types";
import { getHashes, checkNoFilesChanged } from "./hashes";
import { readFile, writeFile, fileExists } from "./utils";
import {
  getConfig,
  loadPrompt,
  updateConfig,
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
import { summarizeFile } from "./ai";

import { abort } from "process";
import { chatLoop } from "./chat";
import { convertToText } from "./conversion";
import { Plugins } from "./plugins/plugins";
import { AwsS3 } from "./services/S3";
import { GitHub } from "./services/GitHub";

export * as clients from "./clients";
export * as agents from "./agents";
export * as ai from "./ai";
export * as services from "./services";
export * as embeddings from "./embeddings";
export * as types from "./types";

const OPENAI_KEY = process.env.OPENAI_KEY;

export async function embed() {
  // load config
  const config = await getConfig();
  const ignorePattern = await getIgnorePattern();

  for (const source of config.embedSources) {
    await embedSource(source, ignorePattern);
  }
}

export async function purge(globPath: string) {
  const files = glob.sync(globPath);
  const embeddings = await getConfiguredEmbeddingMap();
  const config = await getConfig();
  const chunkSizes = config.embedSources.reduce((acc, source) => {
    acc[source.output] = source.chunkSize;
    return acc;
  }, {});

  for (const file of Object.keys(embeddings)) {
    let pruned = embeddings[file];
    for (const filePath of files) {
      const before = pruned.length;
      pruned = pruned
        .filter((e) => !filePath || !e.id.startsWith("./" + filePath))
        .filter((e) => e.text.length <= chunkSizes[file]);
      const after = pruned.length;

      if (after < before) {
        console.log("Purging", filePath);
      }
    }
    await saveEmbedding(file, pruned);
  }
}

export async function upload() {
  const config = await getConfig();

  for (const source of config.embedSources) {
    const bucketName = source.remote;

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

    if (source.remoteType === "s3") {
      console.log(
        "Uploading",
        source.output,
        "to",
        `${bucketName}/${embeddingName}.json`
      );

      const s3Key = `${embeddingName}.json`;
      await AwsS3.uploadFile(source.output, bucketName, s3Key);
    } else {
      console.log(
        "Skipping upload to",
        source.remoteType,
        "for",
        source.remote
      );
    }
  }
}

/*
 *export async function uploadOpenAi() {
 *  const config = await getConfig();
 *  const ignorePattern = await getIgnorePattern();
 *  const assistantsConfig = await getAssistantsConfig();
 *  for (const assistant of config.assistants) {
 *    if (!assistant.model) {
 *      // Skip non openai assistants
 *      continue;
 *    }
 *    if (!assistant.id) {
 *      const fileIds = [];
 *      for (const globPath of assistant.files) {
 *        const files = await glob.sync(globPath, { ignore: ignorePattern });
 *        for (const file of files) {
 *          if (!assistantsConfig.files[file]) {
 *            const uploaded = await uploadToOpenAi(file);
 *            assistantsConfig.files[file] = uploaded.id;
 *            await updateAssistants(assistantsConfig);
 *          }
 *          fileIds.push(assistantsConfig.files[file]);
 *        }
 *      }
 *
 *      const toCreate = {
 *        ...assistant,
 *        files: fileIds,
 *      };
 *      const createdAssistant = await createAssistant(toCreate);
 *      assistant.id = createdAssistant.id;
 *      await updateConfig(config);
 *    }
 *    console.log(`Assistant ${assistant.id} is ready`);
 *  }
 *}
 */

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
      source.model,
      source.input,
      files,
      prompt,
      source.output,
      source.outputExt,
      source.outputName,
      source.kind
    );
  } else {
    await handleSingleOutputGeneration(
      source.model,
      files,
      prompt,
      source.output,
      source.kind
    );
  }
}
export async function handleMultiOutputGeneration(
  model: string,
  inputPattern: string,
  files: string[],
  prompt: string,
  output: string,
  outputExt = "mdx",
  outputName?: string,
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

    // summarize the file
    console.log("Summarizing", file);
    const summary = prompt ? await summarizeFile(file, prompt) : fileContent;

    // write the summary to the output file
    const { name, ext, dir } = path.parse(file);
    const nestedFolder = inputPath ? (dir + "/").replace(inputPath, "") : "";
    const outputFolder = path.join(output, nestedFolder);

    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    outputName = outputName || name;
    const outputFile = path.join(outputFolder, outputName + "." + outputExt);
    console.log({ dir, inputPath, nestedFolder, outputFile });

    const toCheck = [file, outputFile];
    const noChanges = await checkNoFilesChanged(toCheck, promptHash, hashes);
    if (noChanges) {
      console.log("Skipping file", file, "because it hasn't changed");
      continue;
    }

    console.log("Writing summary to", outputFile);
    await writeFile(outputFile, summary);

    await saveAllFileHashes(toCheck, promptHash);
  }
}

export async function handleSingleOutputGeneration(
  model: string,
  files: string[],
  prompt: string,
  outputFile: string,
  kind: string
) {
  const hashes = await getHashes();
  const promptHash = crypto.createHash("md5").update(prompt).digest("hex");

  const filesToCheck = [outputFile, ...files];
  const noChanges = await checkNoFilesChanged(filesToCheck, promptHash, hashes);
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

  await saveAllFileHashes(filesToCheck, promptHash);
}

export async function chat() {
  const config = await getConfig();
  const embeddings = await getConfiguredEmbeddings();
  await chatLoop("knowhow", embeddings, config.plugins);
}

export async function download() {
  const config = await getConfig();

  for (const source of config.embedSources) {
    const { remote, remoteType } = source;

    if (!remote) {
      console.log("Skipping", source.output, "because no remote is configured");
      continue;
    }

    const { name } = path.parse(source.output);
    const fileName = `${name}.json`;
    const destinationPath = source.output;

    if (remoteType === "s3") {
      const bucketName = remote;
      console.log(
        "Downloading",
        fileName,
        `from ${remoteType}`,
        bucketName,
        "to",
        destinationPath
      );
      await AwsS3.downloadFile(bucketName, fileName, destinationPath);
    } else if (remoteType === "github") {
      console.log(
        "Downloading",
        fileName,
        "from GitHub repo",
        remote,
        "to",
        destinationPath
      );
      const embeddingPath = ".knowhow/embeddings/" + fileName;
      await GitHub.downloadFile(remote, embeddingPath, destinationPath);
    } else {
      console.log("Unsupported remote type for", source.output);
    }
  }
}

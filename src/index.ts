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

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const OPENAI_KEY = process.env.OPENAI_KEY;
const embeddingModel = new OpenAIEmbeddings({ openAIApiKey: OPENAI_KEY });
const chatModel = new ChatOpenAI({
  temperature: 0,
  openAIApiKey: OPENAI_KEY,
  modelName: "gpt-4",
  maxRetries: 2,
});
export interface Embeddable<T = any> {
  id: string;
  text: string;
  metadata: T;
}

export async function init() {
  // create the folder structure
  await mkdir(".knowhow", { recursive: true });
  await mkdir(".knowhow/prompts", { recursive: true });
  await mkdir(".knowhow/docs", { recursive: true });

  // create knowhow.json
  const config = {
    promptsDir: ".knowhow/prompts",
    sources: [
      {
        input: "components/**/*.mdx",
        output: ".knowhow/docs/components/",
        prompt: "ComponentDocumenter",
      },
      {
        input: ".knowhow/docs/**/*.mdx",
        output: ".knowhow/README.mdx",
        prompt: "ProjectDocumenter",
      },
    ],
  };
  await writeFile(".knowhow/knowhow.json", JSON.stringify(config, null, 2));
}

export async function generate() {
  // load config
  const config = await getConfig();

  // process each source
  for (const source of config.sources) {
    // read the configured prompt into memory
    const prompt = await readFile(
      path.join(config.promptsDir, `${source.prompt}.mdx`),
      "utf8"
    );

    // get the hash of the prompt
    const promptHash = crypto.createHash("md5").update(prompt).digest("hex");

    // get the files matching the input pattern
    const files = glob.sync(source.input);
    const hashes = await getHashes();

    for (const file of files) {
      // get the hash of the file
      const fileContent = await readFile(file, "utf8");
      const fileHash = crypto
        .createHash("md5")
        .update(fileContent)
        .digest("hex");

      if (!hashes[file]) {
        hashes[file] = { promptHash: "", fileHash: "" };
      }

      if (hashes[file].promptHash === promptHash) {
        continue;
      }

      if (hashes[file].fileHash === fileHash) {
        continue;
      }

      // summarize the file
      const summary = await summarizeFile(file, prompt);

      // write the summary to the output file
      const outputFile = path.join(
        source.output,
        path.basename(file).replace(".mdx", ".summary.mdx")
      );
      await writeFile(outputFile, summary);

      hashes[file] = { promptHash, fileHash };
      await saveHashes(hashes);
    }
  }
}

export async function getHashes() {
  const hashes = JSON.parse(await readFile(".knowhow/.hashes.json", "utf8"));
  return hashes;
}

export async function saveHashes(hashes: any) {
  await writeFile(".knowhow/.hashes.json", JSON.stringify(hashes, null, 2));
}

export async function getConfig() {
  const config = JSON.parse(await readFile(".knowhow/knowhow.json", "utf8"));
  return config;
}

export async function embed() {
  // load config
  const config = await getConfig();

  // get all the files in .knowhow/docs
  const files = glob.sync(".knowhow/docs/**/*.mdx");

  const embeddings: Embeddable[] = [];

  for (const file of files) {
    // get the content of the file
    const text = await readFile(file, "utf8");

    // generate the embedding
    //const embedding = await embeddingModel.embedQuery(text);

    // create the Embeddable object
    const embeddable: Embeddable = {
      id: file,
      text,
      metadata: {
        filepath: file,
        date: new Date().toISOString(),
      },
    };

    embeddings.push(embeddable);
  }

  // save the embeddings to .knowhow/embedding.json
  await writeFile(
    ".knowhow/embeddable.json",
    JSON.stringify(embeddings, null, 2)
  );
}

async function summarizeFile(file: string, template: string) {
  const text = await readFile(file, "utf8");

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
  const docs = await textSplitter.createDocuments([text]);

  const result = await summarizationChain.call({
    input_documents: docs,
  });

  return result.text as string;
}

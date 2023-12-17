import * as path from "path";
import { getConfig, loadPrompt } from "./config";
import { Config, Hashes, Embeddable } from "./types";
import { readFile, writeFile, fileExists, fileStat } from "./utils";
import { summarizeTexts, openai, chunkText } from "./ai";

export async function loadEmbedding(path: string) {
  if (await fileExists(path)) {
    return JSON.parse(await readFile(path, "utf8")) as Embeddable[];
  }
  return [];
}

export async function getConfiguredEmbeddings() {
  const config = await getConfig();
  const files = Array.from(new Set(config.embedSources.map((s) => s.output)));
  const embeddings: Embeddable[] = [];
  for (const file of files) {
    const fileEmbeddings = await loadEmbedding(file);
    embeddings.push(...fileEmbeddings);
  }
  return embeddings;
}

export async function embed(
  id: string,
  text: string,
  metadata: any,
  embeddings: Embeddable[],
  prompt?: string,
  chunkSize?: number,
  uploadMode?: boolean
) {
  let chunks = [text];

  if (chunkSize) {
    chunks = await chunkText(text, chunkSize);
  }

  if (chunks.length > 100) {
    return [];
  }

  if (chunks.length > 25) {
    // Only use the first 25 chunks
    chunks = chunks.slice(0, 25);
  }

  for (let index = 0; index < chunks.length; index++) {
    const chunkId = chunkSize ? `${id}-${index}` : id;
    let chunkText = chunks[index];

    if (embeddings.find((e) => e.id === chunkId && e.text === chunkText)) {
      console.log("Skipping", chunkId);
      continue;
    }

    if (prompt) {
      console.log("Summarizing", chunkText);
      chunkText = await summarizeTexts([chunkText], prompt);
    }

    let vector = [];
    if (!uploadMode) {
      console.log("Embedding", chunkId);
      const queryEmbedding = await openai.embeddings.create({
        input: chunkText,
        model: "text-embedding-ada-002",
      });
      vector = queryEmbedding.data[0].embedding;
    }

    const embeddable: Embeddable = {
      id: chunkId,
      text: chunkText,
      vector,
      metadata: {
        ...metadata,
        text: chunkText,
      },
    };

    embeddings.push(embeddable);
  }

  return embeddings;
}

export async function isEmbeddingFile(inputFile: string) {
  const filePath = path.join(__dirname, inputFile);
  const sourceJson = JSON.parse(
    await readFile(inputFile, "utf8")
  ) as Embeddable[];

  return (
    Array.isArray(sourceJson) &&
    sourceJson.every((e) => e.id && e.text && e.metadata)
  );
}

export async function embedJson(
  inputFile: string,
  source: Config["embedSources"][0]
) {
  const { prompt, output, uploadMode, chunkSize } = source;
  // get all the files in .knowhow/docs
  const filePath = path.join(__dirname, inputFile);
  const sourceJson = JSON.parse(
    await readFile(inputFile, "utf8")
  ) as Embeddable[];

  const embeddings: Embeddable[] = await loadEmbedding(output);

  for (const row of sourceJson) {
    if (embeddings.find((e) => e.id === row.id)) {
      continue;
    }

    const embeddable = await embed(
      row.id,
      row.text,
      row.metadata,
      embeddings,
      prompt,
      chunkSize,
      uploadMode
    );

    await writeFile(output, JSON.stringify(embeddings, null, 2));
  }
}

export async function embedFile(
  inputFile: string,
  source: Config["embedSources"][0]
) {
  const { prompt, output, uploadMode, chunkSize } = source;

  const stat = await fileStat(inputFile);
  if (stat.isDirectory()) {
    return;
  }

  if (inputFile.endsWith(".json") && (await isEmbeddingFile(inputFile))) {
    return embedJson(inputFile, source);
  }

  const embeddings: Embeddable[] = await loadEmbedding(output);
  const fileContent = await readFile(inputFile, "utf8");

  const embeddable = await embed(
    inputFile,
    fileContent,
    {
      filepath: inputFile,
      date: new Date().toISOString(),
    },
    embeddings,
    prompt,
    chunkSize,
    uploadMode
  );

  await writeFile(output, JSON.stringify(embeddings, null, 2));
}

import * as path from "path";
import { getConfig, loadPrompt } from "./config";
import { Config, Hashes, Embeddable, EmbeddingBase } from "./types";
import {
  readFile,
  writeFile,
  fileExists,
  fileStat,
  cosineSimilarity,
} from "./utils";
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

function getChunkId(id: string, index: number, chunkSize: number) {
  return chunkSize ? `${id}-${index}` : id;
}

export async function embed(
  id: string,
  text: string,
  metadata: any,
  embeddings: Embeddable[],
  prompt?: string,
  chunkSize?: number,
  uploadMode?: boolean
): Promise<Array<string>> {
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

  const chunkIds = [];
  const updates = new Array<string>();
  for (let index = 0; index < chunks.length; index++) {
    const chunkId = getChunkId(id, index, chunkSize);
    let chunkText = chunks[index];
    chunkIds.push(chunkId);

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
    updates.push(chunkId);
  }

  // mutate the embedding array
  pruneEmbedding(id, chunkIds, embeddings);
  return updates;
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

    await embed(
      row.id,
      row.text,
      row.metadata,
      embeddings,
      prompt,
      chunkSize,
      uploadMode
    );

    const fileString =
      "[" + embeddings.map((e) => JSON.stringify(e)).join(",") + "]";
    await writeFile(output, fileString);
  }
}

export async function embedFile(
  inputFile: string,
  source: Config["embedSources"][0],
  embeddings = [] as Embeddable[],
  save = true
) {
  const { prompt, output, uploadMode, chunkSize } = source;

  const stat = await fileStat(inputFile);
  if (stat.isDirectory()) {
    return;
  }

  if (inputFile.endsWith(".json") && (await isEmbeddingFile(inputFile))) {
    return embedJson(inputFile, source);
  }

  const fileContent = await readFile(inputFile, "utf8");

  const updates = await embed(
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

  if (save && updates.length > 0) {
    await saveEmbedding(output, embeddings);
  }
}

export async function saveEmbedding(output: string, embeddings: Embeddable[]) {
  const fileString =
    "[" + embeddings.map((e) => JSON.stringify(e)).join(",") + "]";
  await writeFile(output, fileString);
}

export function pruneEmbedding(
  id: string,
  chunkIds: string[],
  embeddings: Embeddable[]
) {
  const relatedChunks = embeddings.filter((e) => e.id.startsWith(id));
  for (let chunk of relatedChunks) {
    if (!chunkIds.includes(chunk.id)) {
      console.log("Removing", chunk.id);
      const index = embeddings.findIndex((e) => e.id === chunk.id);
      embeddings.splice(index, 1);
    }
  }
  return embeddings;
}

export async function queryEmbedding<E>(
  query: string,
  embeddings: Array<Embeddable<E>>
) {
  const queryEmbedding = await openai.embeddings.create({
    input: query,
    model: "text-embedding-ada-002",
  });
  const queryVector = queryEmbedding.data[0].embedding;
  const results = new Array<EmbeddingBase<E>>();
  for (const embedding of embeddings) {
    const similarity = cosineSimilarity(embedding.vector, queryVector);
    results.push({
      ...embedding,
      similarity,
    });
  }
  return results.sort((a, b) => b.similarity - a.similarity);
}

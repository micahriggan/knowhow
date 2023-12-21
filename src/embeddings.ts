import glob from "glob";
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
import { Plugins } from "./plugins/plugins";

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

export async function embedSource(
  source: Config["embedSources"][0],
  ignorePattern: string[]
) {
  console.log("Embedding", source.input, "to", source.output);
  let files = await glob.sync(source.input, { ignore: ignorePattern });

  if (source.kind && files.length === 0) {
    files = [source.input];
  }

  console.log(`Found ${files.length} files`);
  if (files.length > 100) {
    console.error(
      "woah there, that's a lot of files. I'm not going to embed that many"
    );
  }
  console.log(files);
  const embeddings: Embeddable[] = await loadEmbedding(source.output);
  let batch = [];
  let index = 0;
  for (const file of files) {
    index++;
    const shouldSave = batch.length > 20 || index === files.length;
    if (shouldSave) {
      await Promise.all(batch);
      batch = [];
    }
    batch.push(embedKind(file, source, embeddings, shouldSave));
  }
  if (batch.length > 0) {
    await Promise.all(batch);
  }

  // Save one last time just in case
  await saveEmbedding(source.output, embeddings);
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

export async function embedKind(
  id: string,
  source: Config["embedSources"][0],
  embeddings = [] as Embeddable[],
  save = true
) {
  const { prompt, output, uploadMode, chunkSize } = source;

  const stat = !source.kind && (await fileStat(id));
  if (stat && stat.isDirectory()) {
    return;
  }

  if (id.endsWith(".json") && (await isEmbeddingFile(id))) {
    return embedJson(id, source);
  }

  const toEmbed = await handleAllKinds(id, source);

  const updates = [];
  for (const row of toEmbed) {
    const { id, text, metadata } = row;
    const embedded = await embed(
      id,
      text,
      metadata,
      embeddings,
      prompt,
      chunkSize,
      uploadMode
    );
    updates.push(...embedded);
  }

  if (save && updates.length > 0) {
    await saveEmbedding(output, embeddings);
  }
}

async function handleFileKind(filePath: string) {
  return [
    {
      id: filePath,
      text: await readFile(filePath, "utf8"),
      metadata: {
        filepath: filePath,
        date: new Date().toISOString(),
      },
    },
  ];
}

export async function handleAllKinds(
  id: string,
  source: Config["embedSources"][0]
): Promise<Partial<Embeddable>[]> {
  const { input, kind } = source;
  let contents = "";
  let ids = [];

  if (Plugins.isPlugin(kind)) {
    return Plugins.embed(kind, input);
  }
  switch (kind) {
    case "file":
    default:
      return handleFileKind(id);
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

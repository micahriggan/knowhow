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

export async function loadEmbedding(filePath: string) {
  if (await fileExists(filePath)) {
    return JSON.parse(await readFile(filePath, "utf8")) as Embeddable[];
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
  if (!source.input) {
    console.log("Skpping", source.output, "with blank input property");
    return;
  }

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
  uploadMode?: boolean,
  minLength?: number
): Promise<string[]> {
  let chunks = [text];

  if (chunkSize) {
    chunks = await chunkText(text, chunkSize);
  }

  const MAX_CHUNKS = 100;
  if (chunks.length > MAX_CHUNKS) {
    return [];
  }

  if (chunks.length <= MAX_CHUNKS) {
    // Only use the first few chunks
    chunks = chunks.slice(0, MAX_CHUNKS);
  }

  const dontPrune = [];
  const updates = new Array<string>();
  for (let index = 0; index < chunks.length; index++) {
    const chunkId = getChunkId(id, index, chunkSize);
    let textOfChunk = chunks[index];

    const tooShort = minLength && textOfChunk.length < minLength;
    if (tooShort) {
      console.log("Skipping (too short)", chunkId);
      continue;
    }

    dontPrune.push(chunkId);
    const alreadyEmbedded = embeddings.find(
      (e) => e.id === chunkId && e.text === textOfChunk
    );
    if (alreadyEmbedded) {
      console.log("Skipping", chunkId);
      continue;
    }

    if (prompt) {
      console.log("Summarizing", textOfChunk);
      textOfChunk = await summarizeTexts([textOfChunk], prompt);
    }

    let vector = [];
    if (!uploadMode) {
      console.log("Embedding", chunkId);
      const openAiEmbedding = await openai.embeddings.create({
        input: textOfChunk,
        model: "text-embedding-ada-002",
      });
      vector = openAiEmbedding.data[0].embedding;
    }

    const embeddable: Embeddable = {
      id: chunkId,
      text: textOfChunk,
      vector,
      metadata: {
        ...metadata,
        ...(prompt && { text: chunkText }),
      },
    };

    embeddings.push(embeddable);
    updates.push(chunkId);
  }

  // mutate the embedding array
  pruneEmbedding(id, dontPrune, embeddings);
  return updates;
}

export async function isEmbeddingFile(inputFile: string) {
  const filePath = path.join(__dirname, inputFile);
  const sourceJson = JSON.parse(
    await readFile(inputFile, "utf8")
  ) as Embeddable[];

  const isEmbedding =
    Array.isArray(sourceJson) &&
    sourceJson.every((e) => e.id && e.text && e.metadata);

  console.log(`Checking file ${inputFile} for embeddings: ${isEmbedding}`);
  return isEmbedding;
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
  let updates = [];
  let batch = [];

  for (const row of sourceJson) {
    if (embeddings.find((e) => e.id === row.id)) {
      continue;
    }

    console.log("Embedding", row.id);
    batch.push(
      embed(
        row.id,
        row.text,
        row.metadata,
        embeddings,
        prompt,
        chunkSize,
        uploadMode,
        source.minLength
      )
    );

    let embedded = [];
    if (batch.length > 20) {
      embedded = (await Promise.all(batch)).flat();
      batch = [];
    }
    updates.push(...embedded);

    if (updates.length > 20) {
      await saveEmbedding(output, embeddings);
      updates = [];
    }
  }

  // save in case we missed some
  await Promise.all(batch);
  await saveEmbedding(output, embeddings);
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
    console.log("Embedding JSON", id);
    return embedJson(id, source);
  }

  const toEmbed = await handleAllKinds(id, source);

  const updates = [];
  for (const row of toEmbed) {
    const { id: rowId, text, metadata } = row;
    const embedded = await embed(
      rowId,
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
  const contents = "";
  const ids = [];

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
  for (const chunk of relatedChunks) {
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
  embeddings: Embeddable<E>[]
) {
  const openAiEmbedding = await openai.embeddings.create({
    input: query,
    model: "text-embedding-ada-002",
  });
  const queryVector = openAiEmbedding.data[0].embedding;
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

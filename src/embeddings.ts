import { getConfig, loadPrompt } from "./config";
import { Config, Hashes, Embeddable } from "./types";
import { readFile, writeFile, fileExists } from "./utils";
import { summarizeTexts, openai, chunkText } from "./ai";

export async function loadEmbedding(path: string) {
  if (await fileExists(path)) {
    return JSON.parse(await readFile(path, "utf8")) as Embeddable[];
  }
  return [];
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

  for (let index = 0; index < chunks.length; index++) {
    const chunkId = chunkSize ? `${id}-${index}` : id;

    if (embeddings.find((e) => e.id === chunkId)) {
      continue;
    }

    let text = chunks[index];
    if (prompt) {
      console.log("Summarizing", text);
      text = await summarizeTexts([text], prompt);
    }

    let vector = [];
    if (!uploadMode) {
      const queryEmbedding = await openai.embeddings.create({
        input: text,
        model: "text-embedding-ada-002",
      });
      vector = queryEmbedding.data[0].embedding;
    }

    const embeddable: Embeddable = {
      id: chunkId,
      text,
      vector,
      metadata: {
        ...metadata,
        text,
      },
    };

    embeddings.push(embeddable);
  }

  return embeddings;
}

export async function embedJson(
  inputFile: string,
  source: Config["embedSources"][0]
) {
  const { prompt, output, uploadMode, chunkSize } = source;
  // get all the files in .knowhow/docs
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
  if (inputFile.endsWith(".json")) {
    return embedJson(inputFile, source);
  }

  console.log("Embedding", inputFile);
  const embeddings: Embeddable[] = await loadEmbedding(output);
  // get the content of the file
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

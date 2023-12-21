import { getConfiguredEmbeddings, queryEmbedding } from "../embeddings";
import { Plugin } from "./types";

export class EmbeddingPlugin implements Plugin {
  async embed() {
    return [];
  }

  async call(userPrompt: string): Promise<string> {
    const count = 7;
    const embeddings = await getConfiguredEmbeddings();
    const results = await queryEmbedding(userPrompt, embeddings);
    const context = results
      .map((r) => ({ ...r, vector: undefined }))
      .slice(0, count);

    return `EMBEDDING PLUGIN: Our knowledgebase contains this information which can be used to answer the question:
    ${JSON.stringify(context)}`;
  }
}

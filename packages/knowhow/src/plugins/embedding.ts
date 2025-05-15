import { getConfig } from "../config";
import {
  getConfiguredEmbeddings,
  queryEmbedding,
  pruneVector,
  pruneMetadata,
} from "../embeddings";

import { Plugin } from "./types";

export class EmbeddingPlugin implements Plugin {
  async embed() {
    return [];
  }

  async call(userPrompt: string): Promise<string> {
    const count = 7;
    const embeddings = await getConfiguredEmbeddings();
    const config = await getConfig();
    const results = await queryEmbedding(
      userPrompt,
      embeddings,
      config.embeddingModel
    );
    const context = results.slice(0, count);

    pruneVector(context);
    pruneMetadata(context);

    for (const entry of context) {
      console.log(`EMBEDDING PLUGIN: Reading entry ${entry.id}`);
    }

    const contextLength = JSON.stringify(context).split(" ").length;
    console.log(
      `EMBEDDING PLUGIN: Found ${context.length} entries. Loading ${contextLength} words`
    );

    return `EMBEDDING PLUGIN: Our knowledgebase contains this information which can be used to answer the question:
    ${JSON.stringify(context)}`;
  }
}

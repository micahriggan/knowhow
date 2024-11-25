// Tool to search for files related to the user's goal
import { Plugins } from "../../plugins/plugins";
export async function embeddingSearch(keyword: string): Promise<string> {
  return Plugins.call("embeddings", keyword);
}

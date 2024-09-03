import glob from "glob";
import { getConfiguredEmbeddings } from "../../embeddings";
import { execCommand } from "./execCommand";
import { getIgnorePattern } from "../../config";

export async function fileSearch(searchTerm) {
  const searchTermLower = searchTerm.toLowerCase();
  const files = await glob.sync(`./**/*${searchTermLower}*`, {
    ignore: await getIgnorePattern(),
  });
  return JSON.stringify(files);
}

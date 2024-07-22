import { execAsync } from "../../utils";
import { getConfiguredEmbeddings } from "../../embeddings";

export async function fileSearch(searchTerm) {
  const searchTermLower = searchTerm.toLowerCase();
  const command = `find . -name *${searchTermLower}*`;
  console.log("Searching for files with the command: ", command);
  return execAsync(command);
}

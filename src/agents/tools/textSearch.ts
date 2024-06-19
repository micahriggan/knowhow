import { execAsync } from "../../utils";
import { getConfiguredEmbeddings } from "../../embeddings";

export async function textSearch(searchTerm) {
  try {
    const command = `ag ${searchTerm}`;
    const { stdout } = await execAsync(command);
    return stdout; // Return the results of using ag
  } catch (err) {
    console.log(
      "Falling back to embeddings text search since ag was not available"
    );
    const searchTermLower = searchTerm.toLowerCase();
    const embeddings = await getConfiguredEmbeddings();
    const results = embeddings.filter((embedding) =>
      embedding.text.toLowerCase().includes(searchTermLower)
    );
    results.forEach((r) => delete r.vector);
    return results;
  }
}

import glob from "glob";
import { getConfiguredEmbeddings } from "../../embeddings";
import { execCommand } from "./execCommand";
import { getIgnorePattern } from "../../config";
import { toUniqueArray } from "../../utils";

export async function fileSearch(searchTerm) {
  const searchTermLower = searchTerm.toLowerCase();
  const pattern = `./**/*${searchTermLower}*`;
  const ignore = await getIgnorePattern();
  console.log({ pattern, ignore });
  const files = await glob.sync(pattern, {
    ignore,
  });

  if (files.length === 0) {
    const embeddings = await getConfiguredEmbeddings();
    const results = embeddings.filter((embedding) =>
      embedding.id.toLowerCase().includes(searchTermLower)
    );

    // ids are filepath.txt-part
    const ids = toUniqueArray(
      results.map((r) => {
        const parts = r.id.split("-");
        return parts.slice(0, -1).join("-");
      })
    );
    files.push(...ids);
  }

  return JSON.stringify(files);
}

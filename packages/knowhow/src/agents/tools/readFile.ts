import * as fs from "fs";
import { fileExists } from "../../utils";
import { getConfiguredEmbeddings } from "../../embeddings";
import { fileSearch } from "./fileSearch";
import { createPatch } from "diff";

/*
 *export function readFile(filePath: string): string {
 *  try {
 *    const text = fs.readFileSync(filePath, "utf8");
 *    return JSON.stringify(
 *      text.split("\n").map((line, index) => [index + 1, line])
 *    );
 *  } catch (e) {
 *    return e.message;
 *  }
 *}
 */

export async function readFile(filePath: string): Promise<string> {
  const exists = await fileExists(filePath);

  if (!exists) {
    const fileName = filePath.split("/").pop().split(".")[0];
    const maybeRelated = await fileSearch(fileName);
    if (maybeRelated.length > 0) {
      throw new Error(
        `File not found: ${filePath}. Maybe you meant one of these files: ${maybeRelated}`
      );
    }

    throw new Error(`File not found: ${filePath}`);
  }

  const text = fs.readFileSync(filePath, "utf8");
  const patch = createPatch(filePath, "", text);

  return patch;
}

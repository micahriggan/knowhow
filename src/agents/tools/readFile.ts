import * as fs from "fs";
import { FileBlock } from "./types/fileblock";
import { fileExists } from "../../utils";
import { getConfiguredEmbeddings } from "../../embeddings";
import { fileSearch } from "./fileSearch";

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

const BLOCK_SIZE = 500;
export async function readFile(filePath: string): Promise<FileBlock[]> {
  const exists = await fileExists(filePath);

  if (!exists) {
    const fileName = filePath.split("/").pop().split(".")[0];
    const maybeRelated = await fileSearch(fileName);
    if (maybeRelated.stdout.length > 0) {
      throw new Error(
        `File not found: ${filePath}. Maybe you meant one of these files: ${maybeRelated.stdout}`
      );
    }

    throw new Error(`File not found: ${filePath}`);
  }

  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split("");
  const blocks = [] as FileBlock[];

  let index = 0;
  let lineCount = 0;
  while (lines.length > 0) {
    const block = lines.splice(0, BLOCK_SIZE).join("");
    blocks.push({
      blockNumber: index,
      content: block,
      startLine: lineCount + 1,
    });
    index++;
    lineCount += block.split("\n").length;

    if (blocks.length > 20 && lines.length > 160000) {
      blocks.push({
        blockNumber: index,
        content: "File trimmed. Too large to display",
        startLine: lineCount + 1,
      });
      break;
    }
  }

  return blocks;
}

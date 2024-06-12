import * as fs from "fs";
import { FileBlock } from "./types/fileblock";

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
  }

  return blocks;
}

import * as fs from "fs";
import { FileBlock } from "./types/fileblock";

const BLOCK_SIZE = 500;
export async function readBlocks(
  filePath: string,
  blockNumbers: number[] = []
) {
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

  if (blockNumbers.length === 0) {
    return blocks;
  }

  return blocks.filter((block) => blockNumbers.includes(block.blockNumber));
}

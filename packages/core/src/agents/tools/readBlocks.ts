import { readFile } from "./readFile";
export async function readBlocks(filePath: string, blockNumbers: number[]) {
  const fileBlocks = await readFile(filePath);
  return fileBlocks.filter((block) => blockNumbers.includes(block.blockNumber));
}

import * as fs from "fs";
import * as util from "util";
import { applyPatch, createPatch, parsedPatch } from "diff";
import { Plugins } from "../../plugins/plugins";
import { execAsync } from "../../utils";
import { openai, askGptVision } from "../../ai";
import { FileBlock } from "./types/fileblock";

// Tool to search for files related to the user's goal
export async function searchFiles(keyword: string): Promise<string> {
  return Plugins.call("embeddings", keyword);
}

export async function callPlugin(pluginName: string, userInput: string) {
  return Plugins.call(pluginName, userInput);
}

// Tool to read a file
export function readFile(filePath: string): string {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return JSON.stringify(
      text.split("\n").map((line, index) => [index + 1, line])
    );
  } catch (e) {
    return e.message;
  }
}

export function readFileAsBlocks(filePath: string): Array<FileBlock> {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split("\n");
  let blocks = [] as Array<FileBlock>;

  const blockSize = 5;
  let index = 0;
  while (lines.length > 0) {
    const block = lines.splice(0, blockSize).join("\n");
    blocks.push({
      blockNumber: index++,
      content: block,
      startLine: index * blockSize,
    });
  }

  return blocks;
}

export async function readBlocksFromFile(
  filePath: string,
  blockNumbers: number[]
) {
  const fileBlocks = await readFileAsBlocks(filePath);
  return fileBlocks.filter((block) => blockNumbers.includes(block.blockNumber));
}

export async function writeBlocksToFile(
  fileBlocks: Array<FileBlock>,
  filePath: string
) {
  const originalContent = await readFileAsBlocks(filePath);

  for (const block of fileBlocks) {
    originalContent[block.blockNumber].content = block.content;
  }

  const newContent = originalContent.map((b) => b.content).join("");
  fs.writeFileSync(filePath, newContent);

  return readFileAsBlocks(filePath);
}

// Tool to scan a file from line A to line B
export function scanFile(
  filePath: string,
  startLine: number,
  endLine: number
): string {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const lines = fileContent.split("\n");
  const start = Math.max(0, startLine - 5);
  const end = Math.min(lines.length, endLine + 5);
  return JSON.stringify(
    lines.map((line, index) => [index + 1, line]).slice(start, end)
  );
}

// Tool to write the full contents of a file
export function writeFile(filePath: string, content: string): string {
  try {
    fs.writeFileSync(filePath, content);
    return `File ${filePath} written`;
  } catch (e) {
    return e.message;
  }
}

// Tool to apply a patch file to a file
export function applyPatchFile(filePath: string, patch: string): string {
  try {
    const originalContent = fs.readFileSync(filePath, "utf8");

    let updatedContent = applyPatch(originalContent, patch, { fuzzFactor: 1 });
    console.log("Applying patch:");
    console.log(patch);
    console.log("Patched content:", updatedContent);

    if (!patch.endsWith("\n") && !updatedContent) {
      patch += "\n";
      updatedContent = applyPatch(originalContent, patch, { fuzzFactor: 1 });
    }

    if (updatedContent) {
      fs.writeFileSync(filePath, updatedContent);
    }
    return `Patch Applied:\n${updatedContent}`;
  } catch (e) {
    console.error("Error applying patch:", e);
    return e.message;
  }
}

// Tool to execute a command in the system's command line interface
export const execCommand = async (command: string): Promise<string> => {
  try {
    console.log("execCommand:", command);
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      return stderr;
    }
    return stdout;
  } catch (e) {
    return e.message;
  }
};

// Finalize the AI's task and return the answer to the user
export function finalAnswer(answer: string): string {
  return answer;
}

// Add new internal tools to the existing suite
export function addInternalTools(fns: { [fnName: string]: Function }) {
  const callParallel = (
    fnsToCall: Array<{ recipient_name: string; parameters: any }>
  ) => {
    const promises = fnsToCall.map((param) => {
      const name = param.recipient_name.split(".").pop();
      const fn = fns[name];
      const args = Object.values(param.parameters);
      return fn(...args);
    });

    return Promise.all(promises);
  };

  fns["multi_tool_use.parallel"] = callParallel;

  return fns;
}

export async function visionTool(imageUrl: string, question: string) {
  return askGptVision(imageUrl, question);
}

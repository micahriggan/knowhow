import * as fs from "fs";
import * as util from "util";
import { applyPatch, createPatch, parsedPatch } from "diff";
import { Plugins } from "../../plugins/plugins";
import { execAsync } from "../../utils";
import { openai, askGptVision } from "../../ai";
import { FileBlock } from "./types/fileblock";

const BLOCK_SIZE = 500;
// Tool to search for files related to the user's goal
export async function searchFiles(keyword: string): Promise<string> {
  return Plugins.call("embeddings", keyword);
}

export async function callPlugin(pluginName: string, userInput: string) {
  return Plugins.call(pluginName, userInput);
}

// Tool to read a file
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

export async function readFile(filePath: string): Promise<Array<FileBlock>> {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const lines = text.split("");
    let blocks = [] as Array<FileBlock>;

    let index = 0;
    let lineCount = 0;
    while (lines.length > 0) {
      const block = lines.splice(0, BLOCK_SIZE).join("");
      blocks.push({
        blockNumber: index,
        content: block,
        startLine: lineCount,
      });
      index++;
      lineCount += block.split("\n").length;
    }

    return blocks;
  } catch (e) {
    return e.message;
  }
}

export async function readBlocks(filePath: string, blockNumbers: number[]) {
  const fileBlocks = await readFile(filePath);
  return fileBlocks.filter((block) => blockNumbers.includes(block.blockNumber));
}

export async function modifyFile(
  fileBlocks: Array<FileBlock>,
  filePath: string
) {
  try {
    const exists = fs.existsSync(filePath);
    const contentToUpdate = exists ? await readFile(filePath) : [];
    const edits = {};
    const before = [...contentToUpdate];

    for (const block of fileBlocks) {
      if (!contentToUpdate[block.blockNumber]) {
        contentToUpdate[block.blockNumber] = {
          blockNumber: block.blockNumber,
          content: "",
        };
      }

      contentToUpdate[block.blockNumber].content = block.content;
      edits[block.blockNumber] = contentToUpdate[block.blockNumber];
    }

    const newContent = contentToUpdate.map((b) => b.content).join("");
    const beforeContent = before.map((b) => b.content).join("");

    fs.writeFileSync(filePath, newContent);

    const newBlocks = await readFile(filePath);

    console.log("====BEFORE====");
    console.log(beforeContent);
    console.log("====AFTER====");
    console.log(newContent);

    return `
    Before your changes, the text was:
    ${beforeContent}

    After your changes the text is:
    ${newContent}

    Are you sure that was correct? .
    `;
  } catch (e) {
    return e.message;
  }
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

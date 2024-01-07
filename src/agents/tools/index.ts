import * as fs from "fs";
import * as util from "util";
import { exec } from "child_process";
import { applyPatch } from "diff";
import { Plugins } from "../../plugins/plugins";

// Tool to search for files related to the user's goal
export async function searchFiles(keyword: string): Promise<string> {
  return Plugins.call("embeddings", keyword);
}

// Tool to read a file
export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

// Tool to scan a file from line A to line B
export function scanFile(
  filePath: string,
  startLine: number,
  endLine: number
): string {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const lines = fileContent.split("\n");
  return lines.slice(startLine, endLine + 1).join("\n");
}

// Tool to write the full contents of a file
export function writeFile(filePath: string, content: string): string {
  fs.writeFileSync(filePath, content);
  return `File ${filePath} written`;
}

// Tool to apply a patch file
export function applyPatchFile(filePath: string, patch: string): string {
  const originalContent = fs.readFileSync(filePath, "utf8");
  const updatedContent = applyPatch(originalContent, patch);
  fs.writeFileSync(filePath, updatedContent);
  return "Patch applied";
}

// Tool to execute a command
export const execCommand = util.promisify(exec);

export function finalAnswer(answer: string): string {
  return answer;
}

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

import * as fs from "fs";
import * as util from "util";
import { applyPatch } from "diff";
import { Plugins } from "../../plugins/plugins";
import { execAsync } from "../../utils";

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
    return fs.readFileSync(filePath, "utf8");
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
  return lines.slice(startLine, endLine + 1).join("\n");
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
  const originalContent = fs.readFileSync(filePath, "utf8");
  const updatedContent = applyPatch(originalContent, patch);
  fs.writeFileSync(filePath, updatedContent);
  return "Patch applied";
}

// Tool to execute a command in the system's command line interface
export const execCommand = async (command: string): Promise<string> => {
  const { stdout, stderr } = await execAsync(command);
  if (stderr) {
    return stderr;
  }
  return stdout;
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

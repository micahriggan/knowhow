import * as fs from "fs";
import { exec } from "child_process";
import * as util from "util";
import { createPatch, applyPatch } from "diff";
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
export function writeFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content);
}

// Tool to create a patch file
export function createPatchFile(
  originalFile: string,
  updatedFile: string
): string {
  const originalContent = fs.readFileSync(originalFile, "utf8");
  const updatedContent = fs.readFileSync(updatedFile, "utf8");
  return createPatch(originalFile, originalContent, updatedContent);
}

// Tool to apply a patch file
export function applyPatchFile(filePath: string, patch: string): void {
  const originalContent = fs.readFileSync(filePath, "utf8");
  const updatedContent = applyPatch(originalContent, patch);
  fs.writeFileSync(filePath, updatedContent);
}

// Tool to execute a command
export const execCommand = util.promisify(exec);

export function finalAnswer(answer: string): string {
  return answer;
}


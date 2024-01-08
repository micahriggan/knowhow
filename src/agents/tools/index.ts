import * as fs from "fs";
import * as util from "util";
import { exec } from "child_process";
import { applyPatch } from "diff";
import { Plugins } from "../../plugins/plugins";
//import puppeteer from 'puppeteer';

// Tool to search for files related to the user's goal
export async function searchFiles(keyword: string): Promise<string> {
  return Plugins.call("embeddings", keyword);
}

export async function callPlugin(pluginName: string, userInput: string) {
  return Plugins.call(pluginName, userInput);
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

// Tool to apply a patch file to a file
export function applyPatchFile(filePath: string, patch: string): string {
  const originalContent = fs.readFileSync(filePath, "utf8");
  const updatedContent = applyPatch(originalContent, patch);
  fs.writeFileSync(filePath, updatedContent);
  return "Patch applied";
}

// Tool to execute a command in the system's command line interface
const execAsync = util.promisify(exec);
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

// New tool to perform Google search using Puppeteer
/*
 *export async function searchGoogleWithPuppeteer(query: string): Promise<Array<{ href: string; text: string }>> {
 *  const browser = await puppeteer.launch();
 *  const page = await browser.newPage();
 *
 *  await page.goto('https://google.com');
 *  await page.type('input[name=q]', query);
 *  await page.keyboard.press('Enter');
 *
 *  await page.waitForSelector('div#search');
 *
 *  const searchResults = await page.evaluate(() => {
 *    const anchors = Array.from(document.querySelectorAll('div#search .g .rc .r a'));
 *    return anchors.map(anchor => ({ href: anchor.href, text: anchor.textContent || '' }));
 *  });
 *
 *  await browser.close();
 *
 *  return searchResults;
 *};
 */

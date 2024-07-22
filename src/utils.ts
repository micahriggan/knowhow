import gitignoreToGlob from "gitignore-to-glob";
import { promisify } from "util";
import * as util from "util";
import { exec } from "child_process";
import * as fs from "fs";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

marked.use(markedTerminal());

export const fileExists = promisify(fs.exists);
export const readFile = promisify(fs.readFile);
export const writeFile = promisify(fs.writeFile);
export const mkdir = promisify(fs.mkdir);
export const execAsync = util.promisify(exec);
export const fileStat = promisify(fs.stat);
export const wait = promisify(setTimeout);

export const askHistory = [];

export const ask = async (question: string, options: string[] = []) => {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
    history: askHistory,
    completer: (line) => {
      const hits = options.filter((c) => c.startsWith(line));
      return [hits.length ? hits : options, line];
    },
    terminal: true,
  });

  const _ask = util.promisify(readline.question).bind(readline);
  const answer = await _ask(question);
  readline.close();

  return answer;
};

export const Marked = marked;

export function dotp(x, y) {
  function dotp_sum(a, b) {
    return a + b;
  }
  function dotp_times(a, i) {
    return x[i] * y[i];
  }
  return x.map(dotp_times).reduce(dotp_sum, 0);
}

export function cosineSimilarity(A, B) {
  const similarity =
    dotp(A, B) / (Math.sqrt(dotp(A, A)) * Math.sqrt(dotp(B, B)));
  return similarity;
}

const NEWLINE_REPLACE = "<ESC_NEWLINE>";
export function replaceEscapedNewLines(str: string): string {
  const replacedStr = str.replace(/\\n/g, NEWLINE_REPLACE);
  return replacedStr;
}

export function restoreEscapedNewLines(str: string): string {
  return str.replace(new RegExp(NEWLINE_REPLACE, "g"), "\\n");
}

export function splitByNewLines(str: string): string[] {
  const replacedStr = replaceEscapedNewLines(str);

  // Step 2: Split the string by actual new lines
  const parts = replacedStr.split("\n");

  // Step 3: Restore the escaped new lines in the split parts
  return parts.map((part) => restoreEscapedNewLines(part));
}

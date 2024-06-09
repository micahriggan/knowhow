import * as fs from "fs";
import * as util from "util";
import { applyPatch, createPatch, parsedPatch } from "diff";
import { Plugins } from "../../plugins/plugins";
import { execAsync } from "../../utils";
import { openai, askGptVision } from "../../ai";
import { FileBlock } from "./types/fileblock";
import { getConfig } from "../../config";
import { getConfiguredEmbeddings } from "../../embeddings";

const BLOCK_SIZE = 500;
// Tool to search for files related to the user's goal
export async function embeddingSearch(keyword: string): Promise<string> {
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

export async function readBlocks(filePath: string, blockNumbers: number[]) {
  const fileBlocks = await readFile(filePath);
  return fileBlocks.filter((block) => blockNumbers.includes(block.blockNumber));
}

export async function modifyFile(fileBlocks: FileBlock[], filePath: string) {
  try {
    const exists = fs.existsSync(filePath);
    const contentToUpdate = exists ? await readFile(filePath) : [];
    const edits = {};
    const before = [...contentToUpdate];
    const beforeContent = before.map((b) => b.content).join("");

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
    fs.writeFileSync(filePath, newContent);
    const newBlocks = await readFile(filePath);

    console.log("====BEFORE====");
    console.log(beforeContent);
    console.log("====AFTER====");
    console.log(newContent);

    const config = await getConfig();
    const extension = filePath.split(".").pop();
    const lintResult = await lintFile(filePath);

    return `
    Your changes generated this diff:
    ${createPatch(filePath, beforeContent, newContent)}

    ${lintResult && "Linting Result"}
    ${lintResult || ""}

    Are you sure that was correct? .
    `;
  } catch (e) {
    return e.message;
  }
}

export async function lintFile(filePath: string) {
  const config = await getConfig();
  const extension = filePath.split(".").pop();
  let lintResult = "";
  if (config.lintCommands && config.lintCommands[extension]) {
    let lintCommand = config.lintCommands[extension];
    if (lintCommand.includes("$1")) {
      lintCommand = lintCommand.replace("$1", filePath);
    }
    lintResult = await execCommand(`${lintCommand}`);
    console.log("Lint Result:", lintResult);
    return lintResult;
  }
  return "";
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

// Tool to execute a command in the system's command line interface
export const execCommand = async (command: string): Promise<string> => {
  try {
    console.log("execCommand:", command);
    const { stdout, stderr } = await execAsync(command);
    let output = "";
    if (stderr) {
      output += stderr + "\n";
    }
    output += stdout;
    console.log(`$ ${command}:\n${output}`);
    return output;
  } catch (e) {
    const { stdout, stderr } = e;
    console.log({ msg: "catch statement", stderr, stdout });
    console.log("Error executing command:", JSON.stringify(e, null, 2));
    return e;
  }
};

// Finalize the AI's task and return the answer to the user
export function finalAnswer(answer: string): string {
  return answer;
}

// Add new internal tools to the existing suite
export function addInternalTools(fns: {
  [fnName: string]: (...args: any) => any;
}) {
  const callParallel = (
    fnsToCall: { recipient_name: string; parameters: any }[]
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

export async function textSearch(searchTerm) {
  try {
    const command = `ag ${searchTerm}`;
    const { stdout } = await execAsync(command);
    return stdout; // Return the results of using ag
  } catch (err) {
    console.log(
      "Falling back to embeddings text search since ag was not available"
    );
    const searchTermLower = searchTerm.toLowerCase();
    const embeddings = await getConfiguredEmbeddings();
    const results = embeddings.filter((embedding) =>
      embedding.text.toLowerCase().includes(searchTermLower)
    );
    return results;
  }
}

export async function visionTool(imageUrl: string, question: string) {
  return askGptVision(imageUrl, question);
}

/*
 * I want to do this, but circular dependencies are a problem
 *
 *export async function agentCall(agentName: string, userInput: string) {
 *  return agentService.callAgent(agentName, userInput);
 *}
 */

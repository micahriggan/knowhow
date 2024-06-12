import * as fs from "fs";
import { createPatch } from "diff";

import { FileBlock } from "./types/fileblock";
import { readFile } from "./readFile";
import { getConfig } from "../../config";
import { lintFile } from ".";
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

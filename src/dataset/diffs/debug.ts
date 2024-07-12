import "source-map-support/register";

import {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat";
import { parsePatch, diffLines, applyPatch } from "diff";
import { CodebaseAgent } from "../../agents/codebase/codebase";
import dataset from "./dataset.json";
import { ask, writeFile, mkdir, readFile } from "../../utils";
import { fixPatch, parseHunks } from "../../agents/tools/patch";
import { md5Hash } from "../../hashes";

async function debugFailure() {
  const successCount = 0;
  const attempts = 0;
  const testHash = "40eda1dc8f1e3052997f2930ae59fed2";

  let patchData;
  for (const data of dataset) {
    if ((await md5Hash(data.patch)) === testHash) {
      patchData = data;
      break;
    }
  }

  if (patchData) {
    const originalContent = patchData.before;
    const dirName = `./src/dataset/diffs/test_files/fail/${testHash}`;
    const patch = await readFile(`${dirName}/ai-patch.diff`, "utf-8");
    const fixedPatch = fixPatch(patchData.before, patch);
    await writeFile(`${dirName}/ai-fixed-patch.diff`, fixedPatch);

    const updatedContent = applyPatch(originalContent, fixedPatch);
    console.log({ updatedContent });
    const success = !!updatedContent;

    if (updatedContent === patchData.after || fixedPatch === patchData.patch) {
      console.log("SUCCESS");
      console.log("EXACT MATCH");
    } else {
      console.log("AI SUGGESTED");
      console.log(patch);

      console.log("FIXED PATCH");
      console.log(fixedPatch);

      console.log("ACTUAL");
      console.log(patchData.patch);

      console.log("DID PATCH APPLY?", !!updatedContent);
    }
  }

  const parsedAnswer = parsePatch(patchData.patch);
  const fileName = parsedAnswer[0].oldFileName;

  console.log({ successCount, attempts, total: dataset.length });
}

if (require.main === module) {
  debugFailure();
}

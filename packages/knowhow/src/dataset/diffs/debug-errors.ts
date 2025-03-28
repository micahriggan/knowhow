import "source-map-support/register";

import { parsePatch, diffLines, applyPatch } from "diff";
import { PatchingAgent } from "../../agents/patcher/patcher";
import { ask, writeFile, mkdir, readFile } from "../../utils";
import { fixPatch, parseHunks } from "../../agents/tools/patch";

async function debugFailure() {
  const errors = [];
  for (const data of errors) {
    try {
      const { fileContent, fixedPatch, originalPatch } = data;
      const newFixedPatch = fixPatch(fileContent, originalPatch);
      console.log({ originalPatch, newFixedPatch });
      const updatedContent = applyPatch(fileContent, newFixedPatch);
      console.log("DID PATCH APPLY?", !!updatedContent);

      await ask("See output? ");
      console.log(updatedContent);
      await ask("Continue? ");
    } catch (e) {
      console.log(e);
    }
  }
}

if (require.main === module) {
  debugFailure();
}

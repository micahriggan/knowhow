import "source-map-support/register";

import { parsePatch, diffLines, applyPatch } from "diff";
import { CodebaseAgent } from "../../agents/codebase/codebase";
import { ask, writeFile, mkdir, readFile } from "../../utils";
import { fixPatch, parseHunks } from "../../agents/tools/patch";
import errors from "./test_files/errors.json";

async function debugFailure() {
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

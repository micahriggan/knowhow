import { fixPatch, hunksToPatch } from "../../src/agents/tools/patch";
import { createTwoFilesPatch, applyPatch } from "diff";

describe("fixPatch", () => {
  it("should fix corrupted patches", async () => {
    const original =
      Array(10)
        .fill(null)
        .map(() => Math.random().toString(36).substring(2, 15))
        .join("\n") + "\n";

    // Create random change
    const modified = original.split("\n");
    modified[Math.floor(Math.random() * 10)] += "_changed";
    const newString = modified.join("\n");

    // Create patch
    const patch = createTwoFilesPatch(
      "file.txt",
      "file.txt",
      original,
      newString
    );

    // Corrupt the header
    let corruptedPatch = patch.replace(/@@.*/, "@@ -1000,1 +1000,1 @@");
    const corruptedPatchLines = corruptedPatch.split("\n");

    let incorrectLine = true;
    let missingLine = true;
    let sawSubtraction = false;
    for (let i = 4; i < corruptedPatchLines.length; i++) {
      const line = corruptedPatchLines[i];

      if (line.startsWith("-")) {
        sawSubtraction = true;
        break;
      }

      if (line.startsWith(" ") && incorrectLine) {
        corruptedPatchLines[i] = "XXXX";
        incorrectLine = false;
        continue;
      }

      if (line.startsWith(" ") && missingLine) {
        delete corruptedPatchLines[i];
        missingLine = false;
        break;
      }
    }

    corruptedPatch = corruptedPatchLines.join("\n");

    // Try applying corrupted patch (should fail)
    const attempt = applyPatch(original, corruptedPatch);
    // expect(attempt).toBeUndefined();

    // Fix the patch
    console.log({ patch, corruptedPatch });
    let fixedPatch = fixPatch(original, corruptedPatch);
    console.log({ patch, corruptedPatch, attempt, fixedPatch });

    // Apply fixed patch
    const result = applyPatch(original, fixedPatch);

    const header = fixedPatch.split("\n")[0];
    const originalHeader = patch
      .split("\n")
      .find((line) => line.startsWith("@@"));

    if (result !== newString) {
      fixedPatch = fixPatch(original, corruptedPatch);
    }

    expect(result).toBe(newString);
  });
});

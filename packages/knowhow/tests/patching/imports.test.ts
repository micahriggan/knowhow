import * as fs from "fs";
import { parseHunks, fixPatch } from "../../src/agents/tools/patch";
import { applyPatch } from "diff";

describe("fixPatch", () => {
  it("should fix patch", async () => {
    const patch = fs.readFileSync(__dirname + "/imports.patch.txt").toString();
    const originalContent = fs
      .readFileSync(__dirname + "/imports.txt")
      .toString();
    const hunks = parseHunks(patch);

    console.log(hunks);
    expect(hunks.length).toBe(1);

    expect(hunks[0].newStartLine).toBe(6);
    expect(hunks[0].originalStartLine).toBe(5);

    const fixedPatch = await fixPatch(originalContent, patch);
    console.log(fixedPatch);

    const patched = applyPatch(originalContent, fixedPatch);
    console.log("PATCH OUTPUT");
    console.log(patched);
  });

  it("should patch interface.text", async () => {
    const patch = fs
      .readFileSync(__dirname + "/interface.patch.txt")
      .toString();
    const originalContent = fs
      .readFileSync(__dirname + "/interface.txt")
      .toString();

    const hunks = parseHunks(patch);
    const fixedPatch = await fixPatch(originalContent, patch);
    console.log(fixedPatch);

    const patched = applyPatch(originalContent, fixedPatch);
    console.log("PATCH OUTPUT");
    console.log(patched);
  });
});

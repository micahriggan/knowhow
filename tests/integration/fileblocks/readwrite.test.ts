import { readFile, writeFile } from "../../../src/utils";
import { Developer } from "../../../src/agents/codebase/codebase";
describe("Developer", () => {
  test("should be able to patch a codebase", async () => {
    const inputPath = "tests/integration/patching/input.txt";
    const originalText = (await readFile(inputPath)).toString();
    await Developer.call(
      `Update the file in ${inputPath} change the string "finalAnswer" to "FinalAnswer" on line 120. Do not modify anything else. Treat this file as a typescript file.`
    );

    const updatedText = (await readFile(inputPath)).toString();
    await writeFile(inputPath, originalText);

    expect(updatedText).toBe(
      originalText.replace(`"finalAnswer"`, `"FinalAnswer"`)
    );
  });

  test("should be able to update the unseen file", async () => {
    const unseenPath = "tests/integration/patching/unseen.txt";
    const originalText = (await readFile(unseenPath)).toString();
    await Developer.call(
      `Update the file in ${unseenPath} change the file additions and deletions count from 200 to 300. Do not modify anything else. Treat this file as a typescript file.`
    );

    const updatedText = (await readFile(unseenPath)).toString();
    await writeFile(unseenPath, originalText);

    expect(updatedText).toBe(originalText.replaceAll("200", "300"));
  });
});

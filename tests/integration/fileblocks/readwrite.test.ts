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

  test.only("should be able to erase parts of the file", async () => {
    const filePath = "tests/integration/fileblocks/erase.txt";
    const originalText = (await readFile(filePath)).toString();
    await Developer.call(
      `Update the file in ${filePath}. Delete all the lines in the file except the ones that are all B`
    );

    const updatedText = (await readFile(filePath)).toString();
    console.log(updatedText);
    await writeFile(filePath, originalText);

    const allBs = originalText
      .split("\n")
      .filter((line) => line.split("").every((chr) => chr === "B"))
      .join("\n");

    console.log({ allBs });
    expect(updatedText).toBe(allBs);
  });
});

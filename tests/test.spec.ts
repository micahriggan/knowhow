const fs = require("fs");

// Mocking file system and plugins
jest.mock("fs");

// Requiring tools after mocking
import {
  searchFiles,
  readFile,
  scanFile,
  writeFile,
  applyPatchFile,
} from "../src/agents/tools";
import { Plugins } from "../src/plugins/plugins";

test("searchFiles should call the embeddings plugin with the correct keyword", async () => {
  const keyword = "test";
  const expectedResult = JSON.stringify({ files: ["test1.js", "test2.js"] });

  const mocked = jest.mocked(Plugins);
  // Setting up the plugin to return the expected result
  mocked.call.mockResolvedValue(expectedResult);

  const result = await searchFiles(keyword);

  // Verifying that the plugin was called with the correct keyword
  expect(Plugins.call).toHaveBeenCalledWith("embeddings", keyword);
  // Verifying that the function returns the expected result
  expect(result).toBe(expectedResult);
});

test("readFile should return the content of a file", () => {
  const filePath = "test.txt";
  const fileContent = "Hello World";

  // Mock readFile to return the fileContent
  fs.readFileSync.mockReturnValue(fileContent);

  const result = readFile(filePath);

  // Verify readFile was called with the correct file path
  expect(fs.readFileSync).toHaveBeenCalledWith(filePath, "utf8");
  // Verify the result matches the fileContent
  expect(result).toBe(fileContent);
});

test("scanFile should return the contents of a specified range of lines from a file", () => {
  const filePath = "test.txt";
  const fileContentLines = ["Line1", "Line2", "Line3", "Line4", "Line5"];
  const startLine = 1;
  const endLine = 3;

  // Mock fs.readFileSync to return joined fileContentLines
  fs.readFileSync.mockReturnValue(fileContentLines.join("\n"));

  const result = scanFile(filePath, startLine, endLine);

  // Verify fs.readFileSync was called with the correct file path
  expect(fs.readFileSync).toHaveBeenCalledWith(filePath, "utf8");
  // Verify that the correct range of lines is returned
  expect(result).toBe(
    fileContentLines.slice(startLine, endLine + 1).join("\n")
  );
});

test("writeFile should write the full contents to a file", () => {
  const filePath = "testWrite.txt";
  const contentToWrite = "Writing to file";

  // Mock fs.writeFileSync to not actually write to disk
  fs.writeFileSync.mockImplementation(() => {});

  const result = writeFile(filePath, contentToWrite);

  // Verify fs.writeFileSync was called with the correct arguments
  expect(fs.writeFileSync).toHaveBeenCalledWith(filePath, contentToWrite);
  // Verify the function returns a success message
  expect(result).toBe(`File ${filePath} written`);
});

test("applyPatchFile should apply a patch to a file", () => {
  const filePath = "testPatch.txt";
  const originalContent = "Original content\n";
  const patchedContent = "Patched content\n";
  const patch = "@@ -1,1 +1,1 @@\n-Original content\n+Patched content\n";

  // Mock fs.readFileSync to return the originalContent
  fs.readFileSync.mockReturnValue(originalContent);
  // Mock fs.writeFileSync to not actually write to disk
  fs.writeFileSync.mockImplementation(() => {});

  const result = applyPatchFile(filePath, patch);

  // Verify fs.readFileSync was called with the correct file path
  expect(fs.readFileSync).toHaveBeenCalledWith(filePath, "utf8");
  // Verify fs.writeFileSync was called with the correct arguments
  expect(fs.writeFileSync).toHaveBeenCalledWith(filePath, patchedContent);
  // Verify the function returns a success message
  expect(result).toBe("Patch applied");
});

test("it should run a test", () => {
  expect(true).toEqual(true);
});

jest.mock("fs");
jest.mock("../src/plugins/plugins");

import * as fs from "fs";
import { exec } from "child_process";

import {
  searchFiles,
  readFile,
  scanFile,
  modifyFile,
  applyPatchFile,
  execCommand,
} from "../src/agents/tools";
import { Plugins } from "../src/plugins/plugins";

const mockFs = jest.mocked(fs);

test("searchFiles should call the embeddings plugin with the correct keyword", async () => {
  const mocked = Plugins as jest.Mocked<typeof Plugins>;
  const keyword = "test";
  const expectedResult = JSON.stringify({ files: ["test1.js", "test2.js"] });

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
  mockFs.readFileSync.mockReturnValue(fileContent);

  const result = readFile(filePath);

  // Verify readFile was called with the correct file path
  expect(fs.readFileSync).toHaveBeenCalledWith(filePath, "utf8");
  // Verify the result matches the fileContent
  expect(result).toBe(JSON.stringify([[1, fileContent]]));
});

test("scanFile should return the contents of a specified range of lines from a file", () => {
  const filePath = "test.txt";
  const fileContentLines = ["Line1", "Line2", "Line3", "Line4", "Line5"];
  const startLine = 3;
  const endLine = 3;

  // Mock fs.readFileSync to return joined fileContentLines
  mockFs.readFileSync.mockReturnValue(fileContentLines.join("\n"));

  const result = scanFile(filePath, startLine, endLine);

  // Verify fs.readFileSync was called with the correct file path
  expect(fs.readFileSync).toHaveBeenCalledWith(filePath, "utf8");
  // Verify that the correct range of lines is returned
  expect(result).toBe(
    JSON.stringify([
      [1, "Line1"],
      [2, "Line2"],
      [3, "Line3"],
      [4, "Line4"],
      [5, "Line5"],
    ])
  );
});

test("writeFile should write the full contents to a file", () => {
  const filePath = "testWrite.txt";
  const contentToWrite = "Writing to file";

  // Mock fs.writeFileSync to not actually write to disk
  mockFs.writeFileSync.mockImplementation(() => {});

  const result = modifyFile(filePath, contentToWrite);

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
  mockFs.readFileSync.mockReturnValue(originalContent);
  // Mock fs.writeFileSync to not actually write to disk
  mockFs.writeFileSync.mockImplementation(() => {});

  const result = applyPatchFile(filePath, patch);

  // Verify fs.readFileSync was called with the correct file path
  expect(fs.readFileSync).toHaveBeenCalledWith(filePath, "utf8");
  // Verify fs.writeFileSync was called with the corrected content
  expect(fs.writeFileSync).toHaveBeenCalledWith(filePath, patchedContent);
  // Verify the function returns a success message
  expect(result.startsWith("Patch Applied")).toBe(true);
});

test("execCommand should execute a system command and return its output", async () => {
  const command = 'echo "Hello World"';
  const expectedOutput = "Hello World\n";

  // Use the execCommand and expect it to return the correct result
  const result = await execCommand(command);
  expect(result).toEqual(expectedOutput);
});

test("execCommand should return an error message if the command fails", async () => {
  const command = "exit 1";
  const expectedOutput = "Command failed: exit 1\n";

  // Use the execCommand and expect it to return the correct result
  const result = await execCommand(command);
  expect(result).toEqual(expectedOutput);
});

test("it should run a test", () => {
  expect(true).toEqual(true);
});

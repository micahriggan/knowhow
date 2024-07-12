import * as fs from "fs";
import * as util from "util";
import { applyPatch, createPatch } from "diff";
import { Plugins } from "../../plugins/plugins";
import {
  execAsync,
  writeFile,
  readFile,
  fileExists,
  mkdir,
  splitByNewLines,
} from "../../utils";
import { lintFile } from ".";

function findAllLineNumbers(fullText: string, searchText: string) {
  const lines = splitByNewLines(fullText);

  const lineNumbers = lines
    .map((line, index) => {
      if (searchText.startsWith("+") || searchText.startsWith("-")) {
        searchText = searchText.slice(1);
      }
      if (line?.trim() === searchText?.trim()) {
        return index + 1;
      }
    })
    .filter(Boolean);

  return lineNumbers;
}

function findClosestNumber(numbers: number[], goal: number) {
  if (!numbers.length) {
    return goal;
  }
  return numbers.reduce((prev, curr) => {
    return Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev;
  });
}

export interface Hunk {
  header: string;
  headerStart: number;
  headerLength: number;
  firstAdditionLineIndex: number;
  firstSubtractionLineIndex: number;
  lines: string[];
  subtractions: string[];
  additions: string[];
  contextLines: string[];
}

export function parseHunks(patch: string) {
  const patchLines = splitByNewLines(patch);
  const headerIndexes = patchLines
    .map((l, index) => (l.startsWith("@@") ? index : -1))
    .filter((i) => i !== -1);

  const hunks: Hunk[] = [];
  for (let i = 0; i < headerIndexes.length; i++) {
    const header = patchLines[headerIndexes[i]];
    const [start, length] = header.split(" ")[1].split(",");
    const nextHeaderIndex = headerIndexes[i + 1];
    const lines = patchLines.slice(headerIndexes[i] + 1, nextHeaderIndex);

    const firstAdditionLineIndex = Math.max(
      lines
        .filter((l) => !l.trim().startsWith("-"))
        .findIndex((l) => l.trim().startsWith("+")),
      0
    );

    const firstSubtractionLineIndex = Math.max(
      lines
        .filter((l) => !l.trim().startsWith("+"))
        .findIndex((l) => l.trim().startsWith("-")),
      0
    );

    const contextLines = lines.filter(
      (l) => !l.trim().startsWith("+") && !l.trim().startsWith("-")
    );

    const additions = lines.filter((l) => l.trim().startsWith("+"));

    const subtractions = lines.filter((l) => l.trim().startsWith("-"));
    hunks.push({
      header,
      headerStart: Math.abs(Number(start)),
      headerLength: Number(length),
      firstAdditionLineIndex,
      firstSubtractionLineIndex,
      lines,
      additions,
      subtractions,
      contextLines,
    });
  }

  return hunks;
}

export function hunksToPatch(hunks: Hunk[]) {
  return hunks
    .map((hunk) => {
      return [hunk.header, ...hunk.lines].join("\n");
    })
    .join("\n");
}

export function findFirstLineNumber(hunk: Hunk, originalContent: string) {
  if (!originalContent) {
    return 1;
  }

  let index = 0;
  let offset = 0;
  let patchContent = hunk.lines[offset];

  let altLineNumbers = findAllLineNumbers(originalContent, patchContent);
  // Find the next unique line number, and then use that to find the real line number
  // unique means altLineNumbers is 1
  while (altLineNumbers.length !== 1 && index < hunk.lines.length - 1) {
    index++;
    patchContent = hunk.lines[index];
    if (patchContent) {
      altLineNumbers = findAllLineNumbers(originalContent, patchContent);
      if (patchContent.startsWith("-") || patchContent.startsWith(" ")) {
        // the only time we want to increment offset is when a line is in the source file, IE subtraction or context
        offset++;
      }
    }
  }

  console.log(
    "found unique line",
    patchContent,
    "at index",
    index,
    "with offset",
    offset
  );
  console.log("found line numbers for unique line", altLineNumbers);

  const firstLineNumberUnderHeader =
    altLineNumbers.length === 1 ? altLineNumbers[0] - offset : null;

  return firstLineNumberUnderHeader;
}

export function fixHunkContext(hunk: Hunk, originalContent: string) {
  const originalLines = splitByNewLines(originalContent);
  const firstSubtraction = hunk.subtractions[0];

  const firstLineNumberUnderHeader = findFirstLineNumber(hunk, originalContent);
  if (firstSubtraction) {
    const subtractionActualNumber = findAllLineNumbers(
      originalContent,
      firstSubtraction
    )[0];

    // If context is not 3 lines, add more lines, unless it's negative
    const contextStart = Math.max(
      subtractionActualNumber - firstLineNumberUnderHeader >= 3
        ? firstLineNumberUnderHeader
        : subtractionActualNumber - 4,
      1
    );

    // Get all source lines from the start to the subtraction line
    const beforeContext = originalLines
      .slice(contextStart - 1, subtractionActualNumber - 1)
      .map((l) => ` ${l}`);

    const subtractionLineIndex = hunk.lines.indexOf(firstSubtraction);
    hunk.lines.splice(0, subtractionLineIndex, ...beforeContext);
    console.log("before context", beforeContext);
    console.log("corrected", hunk.lines);
  }

  return hunk;
}

export function fixHunkHeader(hunk: Hunk, originalContent: string) {
  let firstLineNumberUnderHeader = findFirstLineNumber(hunk, originalContent);

  const attemptedLineNumber = hunk.headerStart;

  if (!firstLineNumberUnderHeader) {
    console.log("We couldn't fine a unique line");

    const firstLineOriginalNumbers = findAllLineNumbers(
      originalContent,
      hunk.lines[0]
    );
    firstLineNumberUnderHeader = findClosestNumber(
      firstLineOriginalNumbers,
      attemptedLineNumber
    );
  }

  if (hunk.headerStart !== firstLineNumberUnderHeader) {
    console.log(
      "changing hunk header start from ",
      hunk.headerStart,
      "to",
      firstLineNumberUnderHeader
    );
    hunk.headerStart = firstLineNumberUnderHeader;

    const removalStart =
      hunk.subtractions.length > 0
        ? hunk.headerStart + hunk.firstSubtractionLineIndex
        : 0;
    const additionStart =
      hunk.additions.length > 0
        ? hunk.headerStart + hunk.firstAdditionLineIndex
        : 0;

    const removalCount = hunk.subtractions.length + hunk.contextLines.length;
    const additionCount = hunk.additions.length + hunk.contextLines.length;

    hunk.header = `@@ -${removalStart},${removalCount} +${additionStart},${additionCount} @@`;
    console.log(hunk);
  }
  return hunk;
}

export function fixPatch(originalContent: string, patch: string) {
  // Parses a patch, finds all lines with @@ -start,length +start,length @@ and finds the actual line numbers and fixes them by looking at the next line to see where it's actually present

  const hunks = parseHunks(patch);
  console.log(hunks);
  const patchLines = splitByNewLines(patch);

  const originalLines = splitByNewLines(originalContent);

  const isDeletingRealLines = (hunk: Hunk) =>
    hunk.subtractions.every(
      (line) => findAllLineNumbers(originalContent, line).length > 0
    );

  const canFindValidLines = (hunk: Hunk) =>
    findFirstLineNumber(hunk, originalContent);

  const isNotEmptyHunk = (hunk: Hunk) =>
    hunk.lines.length > 0 &&
    (hunk.additions.length > 0 || hunk.subtractions.length > 0);

  const validatedHunks = hunks
    .filter(isDeletingRealLines)
    .filter(canFindValidLines)
    .filter(isNotEmptyHunk)
    .map((hunk) => {
      fixHunkContext(hunk, originalContent);
      return hunk;
    });

  const newPatch = hunksToPatch(hunks);

  const fixedHunks = parseHunks(newPatch).map((hunk) =>
    fixHunkHeader(hunk, originalContent)
  );

  return hunksToPatch(fixedHunks);
}

function compareLine(lineNumber, line, operation, patchContent) {
  return line.trim() === patchContent.trim();
}

async function savePatchError(
  originalPatch: string,
  fixedPatch: string,
  fileContent: string
) {
  const dirName = ".knowhow/tools/patchFile";
  const fileName = "errors.json";
  const filePath = `${dirName}/${fileName}`;
  if (!(await fileExists(filePath))) {
    await mkdir(dirName, { recursive: true });
    await writeFile(filePath, "[]");
  }
  const errors = JSON.parse(await readFile(filePath, "utf8"));
  errors.push({
    originalPatch,
    fixedPatch,
    fileContent,
  });
  await writeFile(filePath, JSON.stringify(errors, null, 2));
}

// Tool to apply a patch file to a file
export async function patchFile(
  filePath: string,
  patch: string
): Promise<string> {
  const compareErrors = [];
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "");
    }
    const originalContent = fs.readFileSync(filePath, "utf8");
    patch = fixPatch(originalContent, patch);

    let updatedContent = applyPatch(originalContent, patch);
    console.log("Applying patch:");
    console.log(patch);

    if (!patch.endsWith("\n") && !updatedContent) {
      patch += "\n";
      updatedContent = applyPatch(originalContent, patch);
    }

    if (updatedContent) {
      fs.writeFileSync(filePath, updatedContent);
    }
    if (!updatedContent) {
      await savePatchError(patch, patch, originalContent);
      throw new Error("Patch failed to apply");
    }

    const lintResult = await lintFile(filePath);

    return `
    Patch has been applied. Use readFile to verify your changest worked.
    ${lintResult && "Linting Result"}
    ${lintResult || ""}
    `;
  } catch (e) {
    return `An error occured while applying the patch: ${e.message}`;
  }
}

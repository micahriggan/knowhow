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

export function fixAccidentalDeletions(hunk: Hunk, originalContent: string) {
  const rebuiltText = hunk.lines
    .filter((l) => !l.startsWith("+"))
    .map((l) => l.slice(1));

  const sourceLines = splitByNewLines(originalContent);
  const relevantSourceLines = sourceLines.slice(
    hunk.headerStart - 1,
    hunk.headerStart - 1 + hunk.lines.length - 1
  );

  const isValid = originalContent.includes(rebuiltText.join("\n"));
  if (isValid) {
    return hunk;
  }

  for (let i = 0; i < rebuiltText.length; i++) {
    if (rebuiltText[i] === relevantSourceLines[i]) {
      continue;
    }

    // the two don't match, check if deletion
    const found = hunk.subtractions.findIndex(
      (l) => l.slice(1) === rebuiltText[i]
    );
    if (found > -1) {
      const lineIndex = hunk.lines.findIndex(
        (l) => l === hunk.subtractions[found]
      );
      hunk.subtractions.splice(found, 1);

      hunk.lines.splice(lineIndex, 1);

      rebuiltText.splice(i, 1);

      console.log("repaired  hunk", hunk);
    }
  }

  const compare = {
    rebuiltText,
    relevantSource: relevantSourceLines,
  };
  console.log(compare);

  return hunk;
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

    let removalStart =
      hunk.subtractions.length > 0
        ? hunk.headerStart + hunk.firstSubtractionLineIndex
        : 0;

    let additionStart =
      hunk.additions.length > 0
        ? hunk.headerStart + hunk.firstAdditionLineIndex
        : 0;

    if (hunk.subtractions.length <= 1 && hunk.additions.length <= 1) {
      // If a hunk contains just one line, only its start line number appears.
      removalStart = hunk.headerStart;
      additionStart = hunk.headerStart;
    }

    const removalCount = hunk.subtractions.length + hunk.contextLines.length;
    const additionCount = hunk.additions.length + hunk.contextLines.length;

    hunk.header = `@@ -${removalStart},${removalCount} +${additionStart},${additionCount} @@`;
    console.log(hunk);
  }
  return hunk;
}

export function fixHunkDeletionTooShort(hunk: Hunk, originalContent: string) {
  return hunk;
  const originalLines = splitByNewLines(originalContent);
  // Finds deletions where the deletion doesn't include the full line, maybe due to newlines

  for (let i = 0; i < hunk.subtractions.length; i++) {
    const deletion = hunk.subtractions[i];
    const deletedText = deletion.slice(1);

    if (originalLines.includes(deletedText)) {
      // exact match, no fix required
      continue;
    }

    console.log({ deletedText });
    // Fix forwards, where you didn't delete enough
    const srcSubtractionIndexForwards = originalLines.findIndex((l) =>
      l.startsWith(deletedText)
    );
    const srcSubtractionIndexBackwards = originalLines.findIndex((l) =>
      l.endsWith(deletedText)
    );

    console.log({ srcSubtractionIndexForwards, srcSubtractionIndexBackwards });

    if (
      srcSubtractionIndexForwards === -1 &&
      srcSubtractionIndexBackwards === -1
    ) {
      // we couldn't find the line, so we can't fix it
      continue;
    }

    const forwards = srcSubtractionIndexForwards > -1;
    const actualIndex = Math.max(
      srcSubtractionIndexForwards,
      srcSubtractionIndexBackwards
    );
    const actualDeletion = originalLines[actualIndex];
    const lineIndex = hunk.lines.indexOf(deletion);

    hunk.subtractions[i] = `-${actualDeletion}`;
    hunk.lines[lineIndex] = `-${actualDeletion}`;

    if (forwards) {
      // The next lines should have been deleted,
      // and are now contained by the actualDeletion so we should remove them
      console.log("Fixing forwards");
      const fixAt = lineIndex + 1;
      const sourceNextLine = originalLines[srcSubtractionIndexForwards + 1];
      while (
        hunk.lines[fixAt] !== sourceNextLine &&
        hunk.lines[fixAt].startsWith(" ") &&
        actualDeletion.includes(hunk.lines[fixAt].slice(1))
      ) {
        console.log("removing", hunk.lines[fixAt]);
        hunk.lines.splice(fixAt, 1);
      }
    } else {
      // The previous lines should have been deleted,
      // and are now contained by the actualDeletion so we should remove them
      let fixAt = lineIndex - 1;
      const sourcePreviousLine =
        originalLines[srcSubtractionIndexBackwards - 1];
      while (
        hunk.lines[fixAt] !== sourcePreviousLine &&
        hunk.lines[fixAt].startsWith(" ") &&
        actualDeletion.includes(hunk.lines[fixAt].slice(1))
      ) {
        console.log("removing", hunk.lines[fixAt]);
        hunk.lines.splice(fixAt, 1);
        console.log("LINES", hunk.lines);
        fixAt--;
      }
    }
  }

  return hunk;
}

export function hunkIsEmpty(hunk: Hunk) {
  const noLines = hunk.lines.length === 0;
  const noChanges =
    hunk.additions.length === 0 && hunk.subtractions.length === 0;

  const additionTexts = hunk.additions.map((l) => l.slice(1));
  const subtractionTexts = hunk.subtractions.map((l) => l.slice(1));
  const additions = additionTexts.join("\n").trim();
  const subtractions = subtractionTexts.join("\n").trim();
  const noChangesText = additions === subtractions;
  const isEmpty = noLines || noChanges || noChangesText;

  return isEmpty;
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

  const isNotEmptyHunk = (hunk: Hunk) => !hunkIsEmpty(hunk);

  const validatedHunks = hunks
    .map((hunk) => fixHunkDeletionTooShort(hunk, originalContent))
    .filter(isDeletingRealLines)
    .filter(canFindValidLines)
    .filter(isNotEmptyHunk)
    .map((hunk) => {
      fixHunkContext(hunk, originalContent);
      return hunk;
    });

  const newPatch = hunksToPatch(validatedHunks);

  const fixedHunks = parseHunks(newPatch)
    .map((hunk) => fixHunkHeader(hunk, originalContent))
    .map((hunk) => fixAccidentalDeletions(hunk, originalContent));

  return hunksToPatch(fixedHunks);
}

export function categorizeHunks(originalContent: string, patch: string) {
  const hunks = parseHunks(patch);

  const validHunks = hunks.filter((hunk) =>
    applyPatch(originalContent, hunksToPatch([hunk]))
  );

  const invalidHunks = hunks.filter(
    (hunk) => !applyPatch(originalContent, hunksToPatch([hunk]))
  );

  return { validHunks, invalidHunks };
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

    const { validHunks, invalidHunks } = categorizeHunks(
      originalContent,
      patch
    );

    const validPatch = hunksToPatch(validHunks);
    let updatedContent = applyPatch(originalContent, validPatch);
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

    const invalidPatch = hunksToPatch(invalidHunks);
    const invalidHunksMessage = invalidHunks.length
      ? `Patch Partially Applied: \n Invalid Hunks: \n${invalidPatch} `
      : "";

    const appliedMessage = validHunks.length
      ? `Valid Hunks Applied: \n${validPatch}`
      : "";

    const lintResult = await lintFile(filePath);

    return `
    ${invalidHunksMessage}
    ${appliedMessage}
    Use readFile to verify your changes worked.
    ${lintResult && "Linting Result"}
    ${lintResult || ""}
    `;
  } catch (e) {
    return `An error occured while applying the patch: ${e.message}`;
  }
}

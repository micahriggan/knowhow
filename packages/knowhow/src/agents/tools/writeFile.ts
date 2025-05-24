import * as fs from "fs";

// Tool to write the full contents of a file
export function writeFile(filePath: string, content: string): string {
  try {
    fs.writeFileSync(filePath, content);
    return `File ${filePath} written`;
  } catch (e) {
    return e.message;
  }
}

export async function writeFileChunk(
  filePath: string,
  content: string,
  isContinuing: boolean,
  isDone: boolean
) {
  if (!filePath || content === undefined) {
    return "File path and content are both required.";
  }

  if (!isContinuing) {
    fs.writeFileSync(filePath, content);
  }

  if (isContinuing) {
    fs.appendFileSync(filePath, content);
  }

  let message = "";

  if (isContinuing) {
    message = "Appended content to file.";
  }

  if (!isDone) {
    message += " Continue calling this tool until file is done.";
  }

  if (isDone) {
    message = " File write complete. Use readFile to verify";
  }

  return message;
}

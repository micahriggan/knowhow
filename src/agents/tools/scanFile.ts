import * as fs from "fs";

// Tool to scan a file from line A to line B
export function scanFile(
  filePath: string,
  startLine: number,
  endLine: number
): string {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const lines = fileContent.split("\n");
  const start = Math.max(0, startLine - 5);
  const end = Math.min(lines.length, endLine + 5);
  return JSON.stringify(
    lines.map((line, index) => [index + 1, line]).slice(start, end)
  );
}

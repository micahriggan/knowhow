import * as fs from "fs";
import * as path from "path";
import { readFile, fileExists } from "./utils";
import { Downloader } from "./plugins/downloader/downloader";

async function convertAudioToText(filePath: string) {
  const parsed = path.parse(filePath);
  const outputPath = `${parsed.dir}/${parsed.name}/transcript.txt`;

  const exists = await fileExists(outputPath);
  if (exists) {
    const fileContent = await readFile(outputPath, "utf8");
    return fileContent;
  }

  const chunks = await Downloader.chunk(filePath, parsed.dir);
  const transcription = await Downloader.transcribeChunks(chunks, outputPath);
  return transcription;
}

export async function convertToText(filePath: string) {
  const extension = filePath.split(".").pop();
  const fileContent = await readFile(filePath, "utf8");

  switch (extension) {
    case "mp3":
    case "mp4":
    case "mpeg":
    case "mpga":
    case "m4a":
    case "wav":
    case "webm":
      return convertAudioToText(filePath);
    default:
      return fileContent;
  }
}

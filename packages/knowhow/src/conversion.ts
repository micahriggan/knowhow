import pdf from "pdf-parse";
import * as fs from "fs";
import * as path from "path";
import { readFile, fileExists } from "./utils";
import { Downloader } from "./plugins/downloader/downloader";

export async function convertAudioToText(
  filePath: string,
  reusePreviousTranscript = true
) {
  const parsed = path.parse(filePath);
  const outputPath = `${parsed.dir}/${parsed.name}/transcript.txt`;

  const exists = await fileExists(outputPath);
  if (exists && reusePreviousTranscript) {
    console.log(`Transcription ${outputPath} already exists, skipping`);
    const fileContent = await readFile(outputPath, "utf8");
    return fileContent;
  }

  const chunks = await Downloader.chunk(
    filePath,
    parsed.dir,
    30,
    reusePreviousTranscript
  );
  const transcription = await Downloader.transcribeChunks(
    chunks,
    outputPath,
    reusePreviousTranscript
  );
  return transcription;
}

async function convertPdfToText(filePath: string) {
  const existingPdfBytes = fs.readFileSync(filePath);
  const data = await pdf(existingPdfBytes);
  return data.text;
}

export async function convertToText(filePath: string) {
  const extension = filePath.split(".").pop();

  switch (extension) {
    case "mp3":
    case "mp4":
    case "mpeg":
    case "mpga":
    case "m4a":
    case "wav":
    case "webm":
    case "mov":
      return convertAudioToText(filePath);
    case "pdf":
      return convertPdfToText(filePath);
    default:
      return readFile(filePath, "utf8");
  }
}

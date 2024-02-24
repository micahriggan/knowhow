import * as fs from "fs";
import * as path from "path";
import ytdl from "youtube-dl-exec";
import Logger from "progress-estimator";
import { DownloadInfo } from "./types";
import { execAsync, fileExists, readFile } from "../../utils";
import { openai } from "../../ai";

const logger = Logger();

class DownloaderService {
  async download(url: string, outputDir: string) {
    const info = await this.info(url);
    const exists = await fileExists(`${outputDir}/${info.id}.${info.ext}`);

    if (exists) {
      console.log("File already exists, skipping download");
      return info;
    }

    const scrape = ytdl(url, { output: `${outputDir}/%(id)s.%(ext)s` });
    const result = await logger(scrape, `Obtaining ${url}`);
    return info;
  }

  async info(url: string) {
    const info = await ytdl(url, {
      dumpSingleJson: true,
      noWarnings: true,
    });
    console.log(info);
    return info;
  }

  public async chunk(
    filePath: string,
    outputDir: string,
    CHUNK_LENGTH_SECONDS = 30
  ) {
    const parsed = path.parse(filePath);
    const fileName = parsed.name;
    const fileExt = parsed.ext;
    console.log({ fileName, fileExt });
    console.log("Chunking file", filePath);

    // create a temp directory
    const outputDirPath = path.join(outputDir, `${fileName}/chunks`);
    await fs.promises.mkdir(outputDirPath, { recursive: true });
    const existingChunks = await fs.promises.readdir(outputDirPath);

    if (existingChunks.length > 0) {
      console.log("Chunks already exist, skipping");
      return existingChunks.map((chunkName) =>
        path.join(outputDirPath, chunkName)
      );
    }

    const command = `ffmpeg -i ${filePath} -f segment -segment_time ${CHUNK_LENGTH_SECONDS} -vn -c copy ${outputDirPath}/chunk%03d.mp3`;
    await execAsync(command);

    const chunkNames = await fs.promises.readdir(outputDirPath);
    console.log("Chunked into", chunkNames.length, "chunks");
    return chunkNames.map((chunkName) => path.join(outputDirPath, chunkName));
  }

  public async transcribeChunks(files: string[], outputPath: string) {
    const exists = await fileExists(outputPath);
    if (exists) {
      console.log("Transcription already exists, skipping");
      const contents = await readFile(outputPath);
      return contents.toString();
    }

    let fullText = "";
    for (const file of files) {
      console.log("Transcribing", file);
      const transcript = await openai.audio.transcriptions.create({
        file: fs.createReadStream(file),
        model: "whisper-1",
      });
      fullText += transcript.text;
    }

    await fs.promises.writeFile(outputPath, fullText);
    return fullText;
  }
}

export const Downloader = new DownloaderService();

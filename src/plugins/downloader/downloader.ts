import * as fs from "fs";
import * as path from "path";
import ytdl from "youtube-dl-exec";
import Logger from "progress-estimator";
import { DownloadInfo } from "./types";
import { execAsync, fileExists, readFile, mkdir } from "../../utils";
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

    const command = `ffmpeg -i "${filePath}" -f segment -segment_time ${CHUNK_LENGTH_SECONDS} -map 0:a:0 -acodec mp3 -vn "${outputDirPath}/chunk%03d.mp3"`;
    await execAsync(command);

    const chunkNames = await fs.promises.readdir(outputDirPath);
    console.log("Chunked into", chunkNames.length, "chunks");
    return chunkNames.map((chunkName) => path.join(outputDirPath, chunkName));
  }

  public async transcribeChunks(
    files: string[],
    outputPath: string,
    reusePreviousTranscript = true
  ) {
    const exists = await fileExists(outputPath);
    if (exists && reusePreviousTranscript) {
      console.log("Transcription already exists, skipping");
      const contents = await readFile(outputPath);
      return contents.toString();
    }

    let fullText = "";
    for (const file of files) {
      const chunkName = path.parse(file).name;
      const chunkTranscriptPath = path.join(
        path.dirname(outputPath),
        `/chunks/${chunkName}.txt`
      );
      const chunkExists = await fileExists(chunkTranscriptPath);

      if (chunkExists && reusePreviousTranscript) {
        console.log("Chunk transcription already exists, skipping");
        const contents = await readFile(chunkTranscriptPath);
        fullText += contents.toString();
        continue;
      }

      console.log("Transcribing", file);
      const transcript = await openai.audio.transcriptions
        .create({
          file: fs.createReadStream(file),
          model: "whisper-1",
        })
        .catch((e) => {
          console.error("Error transcribing", file, e);
          return { text: "" };
        });

      await mkdir(path.dirname(chunkTranscriptPath), { recursive: true });
      await fs.promises.writeFile(chunkTranscriptPath, transcript.text);

      // save chunk transcript to file
      fullText += transcript.text;
    }

    await fs.promises.writeFile(outputPath, fullText);
    return fullText;
  }
}

export const Downloader = new DownloaderService();

import * as fs from "fs";
import * as path from "path";
import ytdl from "youtube-dl-exec";
import Logger from "progress-estimator";
import { DownloadInfo, KeyframeInfo } from "./types";
import { visionTool } from "../../agents/tools/visionTool";
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
    CHUNK_LENGTH_SECONDS = 30,
    reuseExistingChunks = true
  ) {
    const parsed = path.parse(filePath);
    const fileName = parsed.name;
    const fileExt = parsed.ext;
    console.log({ fileName, fileExt });
    console.log("Chunking file", filePath);

    // create a temp directory
    const outputDirPath = path.join(outputDir, `${fileName}/chunks`);
    await fs.promises.mkdir(outputDirPath, { recursive: true });
    const existingFolderFiles = await fs.promises.readdir(outputDirPath);
    const existingChunkNames = existingFolderFiles.filter(
      (f) => f.includes("chunk") && f.endsWith(".mp3")
    );

    if (existingChunkNames.length > 0) {
      if (reuseExistingChunks) {
        console.log("Chunks already exist, skipping");
        return existingFolderFiles.map((chunkName) =>
          path.join(outputDirPath, chunkName)
        );
      } else {
        for (const file of existingFolderFiles) {
          fs.rmSync(path.join(outputDirPath, file), { recursive: true });
        }
      }
    }

    const command = `ffmpeg -i "${filePath}" -f segment -segment_time ${CHUNK_LENGTH_SECONDS} -map 0:a:0 -acodec mp3 -vn "${outputDirPath}/chunk%03d.mp3"`;
    await execAsync(command);

    const folderFiles = await fs.promises.readdir(outputDirPath);
    const chunkNames = folderFiles.filter(
      (f) => f.includes("chunk") && f.endsWith(".mp3")
    );
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
      return JSON.parse(contents.toString()) as string[];
    }

    const fullText = [];
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
        fullText.push(contents.toString());
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
      fullText.push(transcript.text);
    }

    await fs.promises.writeFile(outputPath, JSON.stringify(fullText));
    return fullText;
  }

  public async extractKeyframes(
    filePath: string,
    outputPath: string,
    interval: number = 10
  ): Promise<KeyframeInfo[]> {
    const parsed = path.parse(filePath);
    const outputDir = path.dirname(outputPath);
    const fileName = parsed.name;
    const keyframesDir = path.join(outputDir, `/keyframes`);
    await fs.promises.mkdir(keyframesDir, { recursive: true });

    const command = `ffmpeg -i "${filePath}" -vf "fps=1/${interval},scale=640:-1" "${keyframesDir}/frame%04d.jpg"`;
    await execAsync(command);

    const keyframes = await fs.promises.readdir(keyframesDir);
    const keyframeInfos: KeyframeInfo[] = [];

    for (const keyframe of keyframes) {
      const keyframePath = path.join(keyframesDir, keyframe);
      const keyframeName = path.parse(keyframe).name;
      const keyframeDescriptionPath = path.join(
        keyframesDir,
        `${keyframeName}.json`
      );
      const descriptionExists = await fileExists(keyframeDescriptionPath);

      if (descriptionExists) {
        const cached = await readFile(keyframeDescriptionPath);
        const cachedJson = JSON.parse(cached.toString()) as KeyframeInfo;
        keyframeInfos.push(cachedJson);
        continue;
      }

      const description = await this.describeKeyframe(keyframePath);
      const keyframeJson = {
        path: keyframePath,
        description,
        timestamp: this.extractTimestamp(keyframe, interval),
      };
      await fs.promises.writeFile(
        keyframeDescriptionPath,
        JSON.stringify(keyframeJson, null, 2)
      );
      keyframeInfos.push(keyframeJson);
    }

    await fs.promises.writeFile(outputPath, JSON.stringify(keyframeInfos));

    return keyframeInfos;
  }

  private async describeKeyframe(keyframePath: string): Promise<string> {
    const question =
      "Describe this image in detail, focusing on the main elements and actions visible.";
    const base64 = await fs.promises.readFile(keyframePath, {
      encoding: "base64",
    });
    const image = `data:image/jpeg;base64,${base64}`;
    const description = await visionTool(image, question);
    return description;
  }

  private extractTimestamp(keyframeName: string, interval: number): number {
    const frameNumber = parseInt(keyframeName.match(/\d+/)[0], 10);
    return frameNumber * interval;
  }
}

export const Downloader = new DownloaderService();

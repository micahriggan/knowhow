import { Plugin } from "../types";
import { MinimalEmbedding } from "../../types";
import { convertToText } from "../../conversion";
import { Downloader } from "./downloader";

export class DownloaderPlugin implements Plugin {
  extractUrls(userInput: string): string[] {
    const urlRegex = /https:\/\/[^\s]+/g;
    const matches = userInput.match(urlRegex) || [];
    console.log({ matches });
    return matches;
  }

  async call(userInput: string): Promise<string> {
    const urls = this.extractUrls(userInput);
    if (urls.length === 0) {
      return "DOWNLOADER PLUGIN: No URLs found in the input";
    }
    let transcript = "";
    for (const url of urls) {
      const downloadDir = ".knowhow/downloads/";
      const fileInfo = await Downloader.download(url, downloadDir);
      const filePath = `${downloadDir}${fileInfo.id}.${fileInfo.ext}`;
      transcript += await convertToText(filePath);
    }
    return "DOWNLOADER PLUGIN: " + transcript;
  }

  async embed(userInput: string): Promise<MinimalEmbedding[]> {
    const urls = this.extractUrls(userInput);
    if (urls.length === 0) {
      return [];
    }

    const embeddings: MinimalEmbedding[] = [];
    for (const url of urls) {
      const downloadDir = ".knowhow/downloads/";
      const fileInfo = await Downloader.download(url, downloadDir);
      const filePath = `${downloadDir}${fileInfo.id}.${fileInfo.ext}`;
      const text = await convertToText(filePath);

      embeddings.push({
        id: url,
        text: text,
        metadata: {},
      });
    }

    return embeddings;
  }
}

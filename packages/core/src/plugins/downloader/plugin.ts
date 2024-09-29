import { Plugin } from "../types";
import { MinimalEmbedding } from "../../types";
import { convertToText } from "../../conversion";
import { Downloader } from "./downloader";

export class DownloaderPlugin implements Plugin {
  skipExt = ["jpg", "jpeg", "png", "gif"];

  extractUrls(userInput: string): string[] {
    const urlRegex = /https:\/\/[^\s]+/gim;
    const matches = userInput.match(urlRegex) || [];
    return matches;
  }

  async call(userInput: string): Promise<string> {
    const urls = this.extractUrls(userInput);
    if (urls.length === 0) {
      return "DOWNLOADER PLUGIN: No URLs found in the input";
    }
    let transcript = "";
    for (const url of urls) {
      if (this.skipExt.includes(url.split(".").pop() || "")) {
        console.log("DOWNLOADER PLUGIN: skipping", url);
        continue;
      }
      try {
        console.log("DOWNLOADER PLUGIN: attempting", url);
        const downloadDir = ".knowhow/downloads/";
        const fileInfo = await Downloader.download(url, downloadDir);
        const filePath = `${downloadDir}${fileInfo.id}.${fileInfo.ext}`;
        transcript += await convertToText(filePath);
      } catch (e) {
        console.log("DOWNLOADER PLUGIN: cannot download", url);
      }
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
        text,
        metadata: {},
      });
    }

    return embeddings;
  }
}
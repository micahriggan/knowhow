import { Plugin } from "./types";
import { MinimalEmbedding } from "../types";
import axios from "axios";
import * as cheerio from "cheerio";

export class UrlPlugin implements Plugin {
  async embed(userPrompt: string): Promise<MinimalEmbedding[]> {
    const urls = this.extractUrls(userPrompt);
    const embeddings = await Promise.all(urls.map(this.fetchAndParseUrl));
    return embeddings.filter((e): e is MinimalEmbedding => e !== null);
  }

  extractUrls(userPrompt: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return userPrompt.match(urlRegex) || [];
  }

  async fetchAndParseUrl(url: string): Promise<MinimalEmbedding | null> {
    try {
      const response = await axios.get(url);
      const html = response.data;
      const $ = cheerio.load(html);

      // Remove script and style elements
      $("script, style").remove();

      // Get the text content
      const text = $("body").text().trim().replace(/\s+/g, " ");

      return {
        id: url + "-url",
        text,
        metadata: { url },
      };
    } catch (error) {
      console.error(`Error fetching or parsing URL ${url}:`, error);
      return null;
    }
  }

  async call(userPrompt: string): Promise<string> {
    const urls = this.extractUrls(userPrompt);
    if (urls.length === 0) {
      return "URL PLUGIN: No URLs detected.";
    }

    const results = await Promise.all(urls.map(this.fetchAndParseUrl));
    const validResults = results.filter(
      (r): r is MinimalEmbedding => r !== null
    );

    if (validResults.length === 0) {
      return "URL PLUGIN: Failed to fetch or parse any URLs.";
    }

    const formattedResults = validResults
      .map(
        (result) =>
          `URL: ${result.metadata.url}\n\nContent:\n${result.text.substring(
            0,
            500
          )}...`
      )
      .join("\n\n---\n\n");

    return `URL PLUGIN: Successfully fetched and parsed the following URLs:\n\n${formattedResults}`;
  }
}

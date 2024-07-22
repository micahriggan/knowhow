import { Octokit } from "@octokit/rest";
import { Plugin } from "./types";
import { parseHunks, hunksToPatch } from "../agents/tools/patch";
import { MinimalEmbedding } from "../types";

export class GitHubPlugin implements Plugin {
  octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  async embed(userPrompt: string): Promise<MinimalEmbedding[]> {
    const urls = this.extractUrls(userPrompt);
    const diffs = await this.getParsedDiffs(urls);
    const diffsFiltered = diffs.filter((diff) => diff !== null);

    return diffsFiltered.map((diff, index) => {
      return {
        id: urls[index],
        text: JSON.stringify(diff),
        metadata: {},
      };
    });
  }

  extractUrls(userPrompt: string): string[] {
    const prUrlRegex =
      /https:\/\/github\.com\/([\w-]+)\/([\w-]+)\/pull\/(\d+)/g;
    const matches = userPrompt.match(prUrlRegex);
    return matches;
  }

  async getDiff(url: string) {
    const [owner, repo, _, pullNumber] = url.split("/").slice(-4);
    console.log(
      `GITHUB PLUGIN: Loading diff for ${owner}/${repo}#${pullNumber}`
    );
    const { data: diff } = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: parseInt(pullNumber, 10),
      mediaType: {
        format: "diff",
      },
    });

    return diff;
  }

  async getParsedDiffs(urls: string[]) {
    return Promise.all(
      urls.map(async (url) => {
        const diff = await this.getDiff(url);
        let parsed = parseHunks(diff.toString());

        parsed = parsed.filter((hunk) => {
          return (
            hunk.additions.length < 200 &&
            hunk.subtractions.length < 200 &&
            hunksToPatch([hunk]).length < 10000
          );
        });
        return parsed;
      })
    );
  }

  formatDiff(diff: any) {
    return diff;
  }

  async call(userPrompt: string): Promise<string> {
    const urls = this.extractUrls(userPrompt);

    if (urls) {
      const responses = await this.getParsedDiffs(urls);
      // Format the diffs in Markdown
      const diffStrings = responses.map(hunksToPatch);

      console.log(diffStrings);
      return `GITHUB PLUGIN: These ${urls} have automatically been expanded to include the changes:\n\n${diffStrings}`;
    }

    return "GITHUB PLUGIN: No pull request URLs detected.";
  }
}

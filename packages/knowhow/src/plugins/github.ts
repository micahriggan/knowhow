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

  parseUrl(url: string) {
    const [owner, repo, _, pullNumber] = url.split("/").slice(-4);
    return { owner, repo, pullNumber };
  }

  async getDiff(url: string) {
    const { owner, repo, pullNumber } = this.parseUrl(url);
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

  getLengthOfHunks(hunks: ReturnType<typeof parseHunks>) {
    return hunks
      .flatMap((hunk) => [...hunk.additions, ...hunk.subtractions])
      .reduce((acc, line) => acc + line.length, 0);
  }

  async getPR(url: string) {
    const { owner, repo, pullNumber } = this.parseUrl(url);
    const { data: description } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: parseInt(pullNumber, 10),
    });

    return description;
  }

  async getParsedDiffs(urls: string[]) {
    return Promise.all(
      urls.map(async (url) => {
        const pr = await this.getPR(url);
        const description = pr.body;
        const diff = await this.getDiff(url);
        let parsed = parseHunks(diff.toString());

        console.log(`GITHUB PLUGIN: Parsed ${parsed.length} hunks`);

        const averageHunkSize =
          parsed.reduce((acc, hunk) => acc + hunk.lines.length, 0) /
          parsed.length;

        const totalCharacters = parsed
          .flatMap((hunk) => [...hunk.additions, ...hunk.subtractions])
          .reduce((acc, line) => acc + line.length, 0);

        console.log(
          `GITHUB PLUGIN: Average hunk size: ${averageHunkSize}, total characters: ${totalCharacters}`
        );

        const MAX_CHARACTERS = 10000;
        const PER_HUNK_LIMIT = Math.min(MAX_CHARACTERS / averageHunkSize, 2000);

        parsed = parsed.filter((hunk) => {
          return this.getLengthOfHunks([hunk]) <= PER_HUNK_LIMIT;
        });

        console.log(
          `GITHUB PLUGIN: Filtered to ${
            parsed.length
          } hunks. ${this.getLengthOfHunks(parsed)} characters`
        );
        return [description, ...parsed];
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

      // console.log(diffStrings);
      return `GITHUB PLUGIN: These ${urls} have automatically been expanded to include the changes:\n\n${diffStrings}`;
    }

    return "GITHUB PLUGIN: No pull request URLs detected.";
  }
}

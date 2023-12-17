import { Octokit } from "@octokit/rest";
import { Plugin } from "./types";
import parseDiff from "parse-diff";

export class GitHubPlugin implements Plugin {
  octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  async call(userPrompt: string): Promise<string> {
    // Regular expression to match GitHub pull request URLs
    const prUrlRegex =
      /https:\/\/github\.com\/([\w-]+)\/([\w-]+)\/pull\/(\d+)/g;
    const matches = userPrompt.match(prUrlRegex);

    if (matches) {
      const responses = await Promise.all(
        matches.map(async (url) => {
          const [owner, repo, _, pull_number] = url.split("/").slice(-4);
          console.log(`Loading diff for ${owner}/${repo}#${pull_number}`);
          const { data: diff } = await this.octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: parseInt(pull_number),
            mediaType: {
              format: "diff",
            },
          });

          let parsed = parseDiff(diff.toString());

          parsed = parsed.filter((file) => {
            return file.additions < 200 && file.deletions < 200;
          });

          return parsed;
        })
      );

      // Format the diffs in Markdown
      const markdownDiffs = responses
        .map((diff) => `\`\`\`diff\n${JSON.stringify(diff)}\n\`\`\``)
        .join("\n\n");
      return `GITHUB PLUGIN: The following diffs were loaded:\n\n${markdownDiffs}`;
    }

    return "No GitHub pull request URLs detected.";
  }
}

import { LinearClient } from "@linear/sdk";
import { Plugin } from "./types";

export class LinearPlugin implements Plugin {
  linearClient: LinearClient;

  constructor() {
    this.linearClient = new LinearClient({
      apiKey: process.env.LINEAR_API_KEY,
    });
  }

  async getIssueData(issueId: string) {
    try {
      const issue = await this.linearClient.issue(issueId);
      return issue;
    } catch (error) {
      console.error("Error fetching Linear issue:", error);
      return null;
    }
  }

  async getTaskFromUrl(url: string) {
    const issueId = this.getIdFromUrl(url);
    if (issueId) {
      console.log(`Fetching Linear issue ${issueId}`);
      return await this.getIssueData(issueId);
    }
    return null;
  }

  async getTasksFromUrls(urls: string[]) {
    const tasks = await Promise.all(
      urls.map(async (url) => {
        return this.getTaskFromUrl(url);
      })
    );
    return tasks;
  }

  extractUrls(userPrompt: string): string[] {
    const urlRegex = /https:\/\/linear\.app\/[^\/]+\/issue\/[^\/]+\/[^\/]+/g;
    const matches = userPrompt.match(urlRegex);
    if (!matches) {
      return [];
    }
    return matches;
  }

  getIdFromUrl(url: string): string {
    const urlRegex = /https:\/\/linear\.app\/[^\/]+\/issue\/([^\/]+)\/[^\/]+/g;
    const match = urlRegex.exec(url);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  }

  async call(userPrompt: string): Promise<string> {
    const urls = this.extractUrls(userPrompt);
    if (!urls) {
      return "LINEAR PLUGIN: No issues found";
    }

    const issuesData = await this.getTasksFromUrls(urls);
    const issuesDataFiltered = issuesData.filter((issue) => issue !== null);

    if (issuesDataFiltered.length === 0) {
      return "LINEAR PLUGIN: No issues found";
    }

    const markdownIssues = issuesDataFiltered
      .map(
        (issue) =>
          `### Issue: ${issue.identifier}\n- Title: ${issue.title}\n- URL: ${issue.url} \n- Description: ${issue.description}`
      )
      .join("\n\n");
    return `LINEAR PLUGIN: The following issues were loaded:\n\n${markdownIssues}`;
  }
}

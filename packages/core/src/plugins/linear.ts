import { LinearClient } from "@linear/sdk";
import { Plugin } from "./types";
import { MinimalEmbedding } from "../types";

export class LinearPlugin implements Plugin {
  linearClient: LinearClient;

  constructor() {
    this.linearClient = new LinearClient({
      apiKey: process.env.LINEAR_API_KEY,
    });
  }

  async embed(userPrompt: string): Promise<MinimalEmbedding[]> {
    const urls = this.extractUrls(userPrompt);
    const tasksData = await this.getTasksFromUrls(urls);
    const tasksDataFiltered = tasksData.filter((task) => task !== null);

    return tasksDataFiltered.map((task) => {
      return {
        id: task.url,
        text: this.getTaskString(task),
        metadata: {},
      };
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

  getTaskString(task: any): string {
    return `Issue: ${task.identifier}\nTitle: ${task.title}\nURL: ${task.url} \nDescription: ${task.description}`;
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
      .map((issue) => this.getTaskString(issue))
      .join("\n\n");
    return `LINEAR PLUGIN: The following issues were loaded:\n\n${markdownIssues}`;
  }
}

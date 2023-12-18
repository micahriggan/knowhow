import JiraClient from "jira-client";
import { Plugin } from "./types";

export class JiraPlugin implements Plugin {
  jiraClient: JiraClient;

  constructor() {
    this.jiraClient = new JiraClient({
      protocol: "https",
      host: process.env.JIRA_HOST,
      username: process.env.JIRA_USER,
      password: process.env.JIRA_PASSWORD,
      apiVersion: "2",
      strictSSL: true,
    });
  }

  async getIssueData(issueId: string) {
    try {
      const issue = await this.jiraClient.findIssue(issueId);
      return issue;
    } catch (error) {
      console.error("Error fetching Jira issue:", error);
      return null;
    }
  }

  // https://${process.env.JIRA_HOST}/browse/${issue.key}
  extractUrls(userPrompt: string): string[] {
    const host = process.env.JIRA_HOST;
    const regex = new RegExp(`https://${host}/browse/[A-Z]+-\\d+`, "g");
    const matches = userPrompt.match(regex);
    if (!matches) {
      return [];
    }
    return matches;
  }

  extractIdFromUrl(url: string): string {
    const host = process.env.JIRA_HOST;
    const regex = new RegExp(`https://${host}/browse/([A-Z]+-\\d+)`, "g");
    const matches = regex.exec(url);
    if (matches && matches[1]) {
      return matches[1];
    }
    return null;
  }

  async call(userPrompt: string): Promise<string> {
    const urls = this.extractUrls(userPrompt);
    if (!urls) {
      return "JIRA PLUGIN: No issues found";
    }

    const issuesData = await Promise.all(
      urls.map(async (url) => {
        const issueKey = this.extractIdFromUrl(url);
        if (!issueKey) {
          return null;
        }
        console.log(`Fetching Jira issue ${issueKey}`);
        return await this.getIssueData(issueKey);
      })
    );

    const issuesDataFiltered = issuesData.filter((issue) => issue !== null);

    if (issuesDataFiltered.length === 0) {
      return "JIRA PLUGIN: No issues found";
    }

    const markdownIssues = issuesDataFiltered
      .map(
        (issue) =>
          `### Issue: ${issue.key}\n- Summary: ${issue.fields.summary}\n- URL: ${process.env.JIRA_HOST}/browse/${issue.key} \n- Description: ${issue.fields.description}`
      )
      .join("\n\n");
    return `JIRA PLUGIN: The following issues were loaded:\n\n${markdownIssues}`;
  }
}

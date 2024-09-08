import { Octokit } from "@octokit/rest";

export class GitHubService {
  octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  async downloadFile(
    orgProject: string,
    fileName: string,
    destinationPath: string
  ): Promise<void> {
    const [org, project] = orgProject.split("/");
    const response = await this.octokit.repos.getContent({
      owner: org,
      repo: project,
      path: fileName,
    });
    const fileData = response.data;
    if ("content" in fileData && fileData.content) {
      const content = Buffer.from(fileData.content, "base64").toString("utf-8");
      const fs = require("fs");
      fs.writeFileSync(destinationPath, content);
      console.log(
        `File ${fileName} downloaded from GitHub: ${orgProject} to ${destinationPath}`
      );
    } else {
      throw new Error(
        `File ${fileName} not found in GitHub repo: ${orgProject}`
      );
    }
  }
}

export const GitHub = new GitHubService();

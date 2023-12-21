import { Client } from "asana";
import { Plugin } from "./types";
import { Embeddable, MinimalEmbedding } from "../types";

export class AsanaPlugin implements Plugin {
  asanaClient: Client;

  constructor() {
    this.asanaClient = Client.create({
      defaultHeaders: {
        "Asana-Enable": "new_user_task_lists,new_goal_memberships",
      },
    }).useAccessToken(process.env.ASANA_TOKEN);
  }

  getTaskString(task: any) {
    return `### Task: ${task.name}\n- Description: ${task.notes}\n- URL: ${task.permalink_url}`;
  }

  async embed(userPrompt: string): Promise<MinimalEmbedding[]> {
    const urls = this.extractUrls(userPrompt);
    const tasksData = await this.getTasksFromUrls(urls);
    const tasksDataFiltered = tasksData.filter((task) => task !== null);

    return tasksDataFiltered.map((task) => {
      return {
        id: task.permalink_url,
        text: this.getTaskString(task),
        metadata: {},
      };
    });
  }

  extractUrls(userPrompt: string): string[] {
    const taskUrlRegex = /https:\/\/app\.asana\.com\/0\/(\d+)\/(\d+)/g;
    const matches = userPrompt.match(taskUrlRegex);
    return matches || [];
  }

  async getTasksFromUrls(urls: string[]) {
    const tasks = await Promise.all(
      urls.map(async (url) => {
        return this.getTaskFromUrl(url);
      })
    );
    return tasks;
  }

  async getTaskFromUrl(url: string) {
    const taskId = url.split("/").pop();
    if (taskId) {
      console.log(`Fetching Asana task ${taskId}`);
      return await this.getTaskData(taskId);
    }
    return null;
  }

  async getTaskData(taskId: string) {
    try {
      const task = await this.asanaClient.tasks.findById(taskId);
      return task;
    } catch (error) {
      console.error("Error fetching Asana task:", error);
      return null;
    }
  }

  async call(userPrompt: string): Promise<string> {
    const urls = this.extractUrls(userPrompt);
    const tasksData = await this.getTasksFromUrls(urls);
    const tasksDataFiltered = tasksData.filter((task) => task !== null);

    if (tasksDataFiltered.length === 0) {
      return "ASANA PLUGIN: No tasks found";
    }

    const markdownTasks = tasksDataFiltered
      .map((task) => this.getTaskString(task))
      .join("\n\n");
    return `ASANA PLUGIN: The following tasks were loaded:\n\n${markdownTasks}`;
  }
}

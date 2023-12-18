import { Client } from "asana";
import { Plugin } from "./types";

export class AsanaPlugin implements Plugin {
  asanaClient: Client;

  constructor() {
    this.asanaClient = Client.create({
      defaultHeaders: {
        "Asana-Enable": "new_user_task_lists,new_goal_memberships",
      },
    }).useAccessToken(process.env.ASANA_TOKEN);
  }

  extractUrls(userPrompt: string): string[] {
    const taskUrlRegex = /https:\/\/app\.asana\.com\/0\/(\d+)\/(\d+)/g;
    const matches = userPrompt.match(taskUrlRegex);
    return matches || [];
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
    const tasksData = await Promise.all(
      urls.map(async (url) => {
        const taskId = url.split("/").pop();
        if (taskId) {
          console.log(`Fetching Asana task ${taskId}`);
          return await this.getTaskData(taskId);
        }
        return null;
      })
    );

    const tasksDataFiltered = tasksData.filter((task) => task !== null);

    if (tasksDataFiltered.length === 0) {
      return "ASANA PLUGIN: No tasks found";
    }

    const markdownTasks = tasksDataFiltered
      .map(
        (task) =>
          `### Task: ${task.name}\n- Description: ${task.notes}\n- URL: ${task.permalink_url}`
      )
      .join("\n\n");
    return `ASANA PLUGIN: The following tasks were loaded:\n\n${markdownTasks}`;
  }
}

import { BaseAgent } from "../base/base";
import { Message } from "../../clients/types";
import { Assistant } from "../../types";

export class ConfigAgent extends BaseAgent {
  name: string;
  description: string;

  constructor(private config: Assistant) {
    super();
    this.name = config.name;
  }

  async getInitialMessages(userInput: string) {
    return [
      { role: "system", content: this.config.instructions },
      { role: "user", content: userInput },
    ] as Message[];
  }
}

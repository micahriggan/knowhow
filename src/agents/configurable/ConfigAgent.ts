import { BaseAgent } from "../base/base";
import { ChatCompletionMessageParam } from "openai/resources/chat";
import { Assistant } from "../../types";

export class ConfigAgent extends BaseAgent {
  name: string;

  constructor(private config: Assistant) {
    super();
    this.name = config.name;
  }

  getInitialMessages(userInput: string): ChatCompletionMessageParam[] {
    return [
      { role: "system", content: this.config.instructions },
      { role: "user", content: userInput },
    ];
  }
}

import { ChatCompletionMessageParam } from "openai/resources/chat";
import { BaseAgent } from "../base/base";

export class CodebaseAgent extends BaseAgent {
  name = "Developer";

  getInitialMessages(userInput: string) {
    return [
      {
        role: "system",
        content:
          "Codebase Agent. You use the tools to read and write code, to help the developer implement features faster. Call final answer once you have finished implementing what is requested. As an agent you will receive multiple rounds of input until you call final answer. You are not able to request feedback from the user, so proceed with your plans and the developer will contact you afterwards if they need more help. After modifying files, you will read them to ensure they look correct before calling final answer. You always check your modifications for syntax errors or bugs. You always make the smallest modifications required to files, rather than outputting the entire file. You think step by step about the blocks of code you're modifying. You may use the execCommand tool to navigate the filesystem and to create new folders if needed.",
      },

      { role: "user", content: userInput },
    ] as ChatCompletionMessageParam[];
  }
}

export const Developer = new CodebaseAgent();

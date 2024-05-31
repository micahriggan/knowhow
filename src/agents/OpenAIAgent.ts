import { ThreadCreateParams } from "openai/resources/beta/threads";
import { ChatCompletionMessageParam } from "openai/resources/chat";
import { BaseAgent, IAgent } from "./base/base";
import { openai } from "../ai";
import { wait } from "../utils";
import { Assistant } from "../types";

export class OpenAIAgent implements IAgent {
  name: string;

  constructor(private config: Assistant) {
    this.name = config.name;
  }

  async call(
    userInput: string,
    messages: ChatCompletionMessageParam[] = []
  ): Promise<string> {
    const userThread = [
      { content: userInput, role: "user" },
    ] as ThreadCreateParams.Message[];

    const response = await openai.beta.threads.createAndRun({
      assistant_id: this.config.id,
      model: this.config.model,
      instructions: this.config.instructions,
      tools: this.config.tools,
      thread: { messages: userThread },
    });

    const threadId = response.thread_id;
    const runId = response.object;

    console.log(response);

    let status = response.status;

    while (status === "in_progress" || status === "queued") {
      console.log("Waiting for assistant...");
      const runs = await openai.beta.threads.runs.retrieve(threadId, runId);
      status = runs.status;
      await wait(500);
    }

    const assistantReply = await openai.beta.threads.messages.list(threadId);

    console.log({ assistantReply });

    return assistantReply[0].content;
  }
}

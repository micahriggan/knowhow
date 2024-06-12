import { ChatCompletionMessageParam } from "openai/resources/chat";

export interface IAgent {
  name: string;
  call: (
    userInput: string,
    messages?: ChatCompletionMessageParam[]
  ) => Promise<string>;
}

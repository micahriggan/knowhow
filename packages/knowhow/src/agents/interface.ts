import { Message } from "../clients/types";

export interface IAgent {
  name: string;
  description: string;
  call: (userInput: string, messages?: Message[]) => Promise<string>;
}

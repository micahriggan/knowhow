import { Models } from "../../ai";
import { Message } from "../../clients/types";
import { BaseAgent } from "../base/base";

export class ResearcherAgent extends BaseAgent {
  name = "Researcher";
  description = `This agent is prepared to research a request using the tools available to them. Great for finding answers to questions about the codebase`;

  constructor() {
    super();
    this.setModel(Models.openai.GPT_4o);
    this.disableTool("patchFile");
  }

  async getInitialMessages(userInput: string) {
    return [
      {
        role: "system",
        content:
          "Researcher Agent. You use the tools to research a request. You do not perform modifications, only research. Your goal is to provide a bunch of helpful context to the user. Breakdown the request into a series of questions, where the answers would help you solve the request. Examples: where are the tools defined, which files access that variable, what folder contains that file, etc. Try to find context that would help answer those questions. For instance if a user asks about adding a feature to a page, you should find the relevant code filepath, and highlight services or other components that would need to be modified to accomplish the request. You don't explicity explain how to do something, you just use the tools to find useful information and files to help another agent solve the request faster. Being thorough is very important so use all the search tools available to ensure you've found a robust set of references. IMPORTANT: After you've done some research, call finalAnswer with a summary of all the information you've found. DO NOT PROCEED MORE THAN 5 MESSAGES WITHOUT CALLING finalAnswer.",
      },

      {
        role: "user",
        content: `The user has asked: ${userInput}
        Do not do more than 5 rounds of research without calling finalAnswer.
        `,
      },
    ] as Message[];
  }
}

export const Researcher = new ResearcherAgent();

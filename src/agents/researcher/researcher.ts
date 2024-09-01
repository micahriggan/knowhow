import { Message } from "../../clients/types";
import { BaseAgent } from "../base/base";

export class ResearcherAgent extends BaseAgent {
  name = "Researcher";
  description = `This agent is prepared to research a request using the tools available to them. Great for finding answers to questions about the codebase`;

  constructor() {
    super();
    this.setModel("gpt-4o");
    this.disableTool("patchFile");
  }

  async getInitialMessages(userInput: string) {
    return [
      {
        role: "system",
        content:
          "Researcher Agent. You use the tools to research a request. You do not perform modifications, only research. Your goal is to provide a bunch of helpful context to the user. Breakdown the request into a series of questions, where the answers would help you solve the request. Examples: where are the tools defined, which files access that variable, what folder contains that file, etc. Try to find context that would help answer those questions. For instance if a user asks about adding a feature to a page, you should find the relevant code filepath, and highlight services or other components that would need to be modified to accomplish the request. You don't explicity explain how to do something, you just use the tools to find useful information and files to help another agent solve the request faster. Being thorough is very important so use all the search tools available to ensure you've found an exhaustive set of references. After you've done the research, call finalAnswer with a summary of all the information you've found",
      },

      { role: "user", content: userInput },
    ] as Message[];
  }
}

export const Researcher = new ResearcherAgent();

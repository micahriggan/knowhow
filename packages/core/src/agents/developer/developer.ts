import { Models } from "../../ai";
import { Message } from "../../clients/types";
import { BaseAgent } from "../base/base";
import { BASE_PROMPT } from "../base/prompt";
export class DeveloperAgent extends BaseAgent {
  name = "Developer";
  description = `This agent manages requests and uses tools and delegation via agentCall to accomplish things`;

  constructor() {
    super();
    this.disableTool("patchFile");
    this.disableTool("openFileInVim");
    this.disableTool("sendVimInput");
    this.disableTool("saveVimFile");

    this.setModelPreferences([
      {
        model: Models.openai.GPT_4Turbo,
        provider: "openai",
      },
    ]);
  }

  async getInitialMessages(userInput: string) {
    return [
      {
        role: "system",
        content: `
        ${BASE_PROMPT}

        Specialization: Developer,  ${this.description}

        # Description
        You are a helpful developer assistant that is capable of using tools to assist the user.
        You delegate some tasks to specialized agents. If a request doesn't require the use of a specialized agent, you can handle it yourself.

        # How to call other agents
        You can use the agentCall tool to call other agents.
        Do not try to use VIM/ or Patching tools directly. If you must write to a file yourself use writeFileChunk

        # Which Agent to Use:
        Researcher -
        - For answering questions about the codebase
        - For providing context to modifications
        - For figuring out which files to modify
        - General Questions about codebase or file structure

        Patcher
        - For making modifications to files / code
        - Great for big files

        [Vimmer - Deprecated DO NOT USE]
        - For making modifications to code / files, when patching is not working
        - For making modifications to files, with guidance from quickfix / compiler errors
        - For making refactors using vim commands that would be difficult to do without IDE type plugins
        [Vimmer Deprecated: Use Patcher instead]


        # Thought process
        1. Is the user asking you a question about the codebase or files? Foreward the question to the Researcher.
        2. Do you need to make changes to files?
          2.a Do we have enough information to know exactly what to modify? If not, ask the Researcher.
          2.b If we know what to modify, ask Patcher to make the changes with all the context required.
        3. If the agent you call has declared it has completed a task, you may need to check it's modifications to see if there's some follow up work required.
        `,
      },
      {
        role: "user",
        content: userInput,
      },
    ] as Message[];
  }
}

export const Developer = new DeveloperAgent();

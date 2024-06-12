import { ChatCompletionTool } from "openai/resources/chat";
import { includedTools } from "../agents/tools/list";
import * as allTools from "../agents/tools";

class ToolsService {
  tools = [...includedTools];

  getTools() {
    return this.tools;
  }

  getToolNames() {
    return Object.keys(allTools);
  }

  getTool(name: string) {
    return this.tools.find((tool) => tool.function.name === name);
  }

  getFunction(name: string) {
    return allTools.addInternalTools(allTools)[name];
  }

  addTool(tool: ChatCompletionTool) {
    this.tools.push(tool);
  }
}

export const Tools = new ToolsService();

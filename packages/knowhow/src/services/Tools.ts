import { ChatCompletionTool } from "openai/resources/chat";
import { includedTools } from "../agents/tools/list";
import * as allTools from "../agents/tools";
import { Tool } from "../clients/types";

export class ToolsService {
  tools = [...includedTools];

  functions = {};

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
    return this.functions[name] || allTools.addInternalTools(allTools)[name];
  }

  setFunction(name: string, func: (...args: any) => any) {
    this.functions[name] = func;
  }

  addTool(tool: Tool) {
    this.tools.push(tool);
  }
}

export const Tools = new ToolsService();

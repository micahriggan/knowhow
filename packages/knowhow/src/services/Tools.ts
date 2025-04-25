import { ChatCompletionTool } from "openai/resources/chat";
import { includedTools } from "../agents/tools/list";
import { Tool } from "../clients/types";

export class ToolsService {
  tools = [] as Tool[];

  functions = {};

  getTools() {
    return this.tools;
  }

  getToolsByNames(names: string[]) {
    return this.tools.filter((tool) => names.includes(tool.function.name));
  }

  copyToolsFrom(toolNames: string[], toolsService: ToolsService) {
    const tools = toolsService.getToolsByNames(toolNames);
    this.addTools(tools);

    for (const name of toolNames) {
      this.setFunction(name, toolsService.getFunction(name));
    }
  }

  getToolNames() {
    return this.tools.map((tool) => tool.function.name);
  }

  getTool(name: string): Tool {
    return this.tools.find((tool) => tool.function.name === name);
  }

  getFunction(name: string) {
    // return this.functions[name] || allTools.addInternalTools(allTools)[name];
    return this.functions[name];
  }

  setFunction(name: string, func: (...args: any) => any) {
    this.functions[name] = func;
  }

  setFunctions(names: string[], funcs: ((...args: any) => any)[]) {
    for (let i = 0; i < names.length; i++) {
      this.setFunction(names[i], funcs[i]);
    }
  }

  addTool(tool: Tool) {
    this.tools.push(tool);
  }

  addTools(tools: Tool[]) {
    this.tools.push(...tools);
  }

  addFunctions(fns: { [fnName: string]: (...args: any) => any }) {
    for (const fnName of Object.keys(fns)) {
      this.setFunction(fnName, fns[fnName]);
    }
  }
}

export const Tools = new ToolsService();

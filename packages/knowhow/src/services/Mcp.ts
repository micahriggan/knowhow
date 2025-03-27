import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import Anthropic from "@anthropic-ai/sdk";

import { McpConfig } from "../types";
import { Tool } from "../clients";
import { getConfig } from "../config";
import { ToolsService } from "./Tools";

type CachedTool = Anthropic.Beta.PromptCaching.PromptCachingBetaTool;
type McpTool = CachedTool & {
  inputSchema: CachedTool["input_schema"];
};

export const knowhowClient = {
  name: "knowhow-mcp-client",
  version: "1.0.0",
};
export const knowhowConfig = {
  capabilities: {
    prompts: {},
    resources: {},
    tools: {},
  },
};

export class McpService {
  connected = false;
  transports: StdioClientTransport[] = [];
  clients: Client[] = [];
  config: McpConfig[] = [];
  tools: Tool[] = [];

  async createClients(mcpServers: McpConfig[] = []) {
    if (this.clients.length) {
      return this.clients;
    }

    this.config = mcpServers;
    this.transports = mcpServers.map((mcp) => {
      console.log("Creating transport for", mcp);
      return new StdioClientTransport(mcp);
    });

    this.clients = this.transports.map((transport) => {
      return new Client(knowhowClient, knowhowConfig);
    });

    return this.clients;
  }

  async connectToConfigured(tools?: ToolsService) {
    const config = await getConfig();

    return this.connectTo(config.mcps, tools);
  }

  async connectTo(mcpServers: McpConfig[] = [], tools?: ToolsService) {
    const clients = await this.createClients(mcpServers);
    await this.connectAll();

    if (tools) {
      tools.addTools(await this.getTools());
      tools.addFunctions(await this.getToolMap());
    }
  }

  async closeTransports() {
    await Promise.all(
      this.transports.map((transport) => {
        transport.close();
      })
    );

    this.transports = [];
    this.connected = false;
  }

  async closeClients() {
    await Promise.all(
      this.clients.map((client) => {
        client.close();
      })
    );

    this.clients = [];
    this.connected = false;
  }

  async closeAll() {
    await this.closeTransports();
    await this.closeClients();
  }

  getClientIndex(clientName: string) {
    const index = this.config.findIndex((mcp) => mcp.name === clientName);
    return index;
  }

  parseToolName(toolName: string) {
    const split = toolName.split("_");

    if (split.length < 2) {
      return null;
    }

    return split.slice(2).join("_");
  }

  getToolClientIndex(toolName: string) {
    const split = toolName.split("_");

    if (split.length < 2) {
      return -1;
    }

    const index = Number(split[1]);
    return index;
  }

  getToolClient(toolName: string) {
    const index = this.getToolClientIndex(toolName);

    if (index < 0) {
      throw new Error(`Invalid tool name ${toolName}`);
    }

    return this.clients[index];
  }

  getFunction(toolName: string) {
    const client = this.getToolClient(toolName);

    const realName = this.parseToolName(toolName);
    return async (args: any) => {
      console.log("Calling tool", realName, "with args", args);
      const tool = await client.callTool({
        name: realName,
        arguments: args,
      });
      return tool;
    };
  }

  async getFunctions() {
    const tools = await this.getTools();
    return tools.map((tool) => {
      return this.getFunction(tool.function.name);
    });
  }

  async getToolMap() {
    const tools = await this.getTools();
    return tools.reduce((acc, tool) => {
      acc[tool.function.name] = this.getFunction(tool.function.name);
      return acc;
    }, {});
  }

  async connectAll() {
    if (this.connected) {
      return;
    }

    await Promise.all(
      this.clients.map((client, index) => {
        return client.connect(this.transports[index]);
      })
    );

    this.connected = true;
  }

  async getClient() {
    if (this.clients.length) {
      return this.clients;
    }

    this.clients = await this.createClients(this.config);

    return this.clients;
  }

  async getTools() {
    if (this.tools.length) {
      return this.tools;
    }

    const tools = [] as Tool[];

    for (let i = 0; i < this.config.length; i++) {
      const config = this.config[i];
      const client = this.clients[i];
      const clientTools = await client.listTools();
      const transformedTools = clientTools.tools.map((tool) => {
        return this.toOpenAiTool(i, tool as any as McpTool);
      });
      tools.push(...transformedTools);
    }

    this.tools = tools;
    return tools;
  }

  toOpenAiTool(index: number, tool: McpTool) {
    const transformed: Tool = {
      type: "function",
      function: {
        name: `mcp_${index}_${tool.name}`,
        description: tool.description,
        parameters: {
          type: "object",
          positional: Boolean(tool.inputSchema.positional),
          properties: tool.inputSchema.properties as any,
          required: tool.inputSchema.required as string[],
        },
      },
    };

    return transformed;
  }
}

export const Mcp = new McpService();

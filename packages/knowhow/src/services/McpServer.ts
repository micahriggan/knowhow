import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { Tool, ToolProp } from "../clients/types";
import { ToolsService } from "./Tools";
import { MCPWebSocketTransport } from "./McpWebsocketTransport";
import { WebSocket } from "ws";

export class McpServerService {
  server: McpServer | null = null;
  constructor(private toolsService: ToolsService) {}
  registeredTools = new Set<string>();

  createServer(name: string, version: string) {
    if (this.server) {
      return this;
    }

    this.server = new McpServer({
      name,
      version,
    });

    return this;
  }

  toZodSchema(properties: { [key: string]: ToolProp }): z.ZodObject<any> {
    const schema: Record<string, z.ZodTypeAny> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (value.type === "string") {
        schema[key] = z.string();
      } else if (value.type === "number") {
        schema[key] = z.number();
      } else if (value.type === "boolean") {
        schema[key] = z.boolean();
      } else if (value.type === "array" && value.items) {
        schema[key] = z.array(this.toZodSchema({ item: value.items }));
      } else if (value.type === "object" && value.properties) {
        schema[key] = this.toZodSchema(value.properties);
      } else {
        schema[key] = z.any();
      }
    }
    return z.object(schema);
  }

  withTools(tools: Tool[]) {
    for (const tool of tools) {
      const props = tool.function.parameters.properties;

      if (!props) {
        console.warn(`Tool ${tool.function.name} has no properties`);
        continue;
      }

      if (this.registeredTools.has(tool.function.name)) {
        console.log(`Tool ${tool.function.name} already registered`);
        continue;
      }

      console.log(`Registering tool ${tool.function.name}`);
      this.registeredTools.add(tool.function.name);

      const shape = this.toZodSchema(props).shape;

      this.server.tool(
        tool.function.name,
        tool.function.description,
        shape,
        async (args, extra) => {
          const fn = this.toolsService.getFunction(tool.function.name);

          let response = "";
          if (tool.function.parameters.positional) {
            response = await fn(...Object.values(args));
          } else {
            response = await fn(args);
          }

          return {
            content: [
              {
                type: "text",
                text:
                  typeof response === "string"
                    ? response
                    : JSON.stringify(response),
              },
            ],
          };
        }
      );
    }
    return this;
  }

  createServerWithAllTools(name: string, version: string) {
    return this.createServer(name, version).withTools(
      this.toolsService.getTools()
    );
  }

  async runStdioServer() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`MCP Server running on stdio`);
  }

  async runWsServer(ws: WebSocket) {
    const transport = new MCPWebSocketTransport(ws);
    await this.server.connect(transport);
    console.error(`MCP Server running on websocket`);
  }
}

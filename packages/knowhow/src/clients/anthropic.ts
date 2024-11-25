import Anthropic from "@anthropic-ai/sdk";
import { getConfigSync } from "../config";
import {
  GenericClient,
  CompletionOptions,
  CompletionResponse,
  Tool,
  Message,
} from "./types";

const config = getConfigSync();

type CachedMessageParam =
  Anthropic.Beta.PromptCaching.PromptCachingBetaMessageParam;
type CachedTool = Anthropic.Beta.PromptCaching.PromptCachingBetaTool;

export class GenericAnthropicClient extends Anthropic implements GenericClient {
  constructor() {
    super({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  handleToolCaching(tools: CachedTool[]) {
    const lastTool = tools[tools.length - 1];

    if (lastTool) {
      lastTool.cache_control = { type: "ephemeral" };
      console.log("caching last tool");
    }
  }

  transformTools(tools?: Tool[]): CachedTool[] {
    if (!tools) {
      return [];
    }
    const transformed = tools.map((tool) => ({
      name: tool.function.name || "",
      description: tool.function.description || "",
      input_schema: {
        properties: tool.function.parameters.properties,
        type: "object" as const,
        required: tool.function.parameters.required || [],
      },
    }));

    this.handleToolCaching(transformed);

    return transformed;
  }

  toBlockArray(content: Anthropic.MessageParam["content"]) {
    if (typeof content === "string") {
      return [
        {
          text: content,
          type: "text",
        },
      ] as Anthropic.TextBlockParam[];
    }
    if (Array.isArray(content)) {
      return content.map((c) => {
        if (typeof c === "string") {
          return {
            text: c,
            type: "text",
          } as Anthropic.TextBlockParam;
        }
        return c;
      });
    }
    return content;
  }

  combineMessages(
    messages: Anthropic.MessageParam[]
  ): Anthropic.MessageParam[] {
    if (messages.length <= 1) {
      return messages;
    }
    for (let i = 0; i < messages.length; i++) {
      if (i - 1 >= 0) {
        const currentMessage = messages[i];
        const previousMessage = messages[i - 1];
        if (currentMessage?.role === previousMessage?.role) {
          previousMessage.content = this.toBlockArray(previousMessage.content);
          previousMessage.content.push(
            ...this.toBlockArray(currentMessage.content)
          );
          messages.splice(i, 1);
          i--;
        }
      }
    }
    return messages;
  }

  cacheLastContent(message: CachedMessageParam) {
    if (Array.isArray(message.content)) {
      message.content[message.content.length - 1].cache_control = {
        type: "ephemeral",
      };
    }
  }

  handleClearingCache(messages: CachedMessageParam[]) {
    for (const message of messages) {
      if (Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.cache_control) {
            delete content.cache_control;
          }
        }
      }
    }
  }

  handleMessageCaching(groupedMessages: CachedMessageParam[]) {
    this.handleClearingCache(groupedMessages);

    const hasTwoUserMesages =
      groupedMessages.filter((m) => m.role === "user").length >= 2;

    const firstUserMessage = groupedMessages.find((m) => m.role === "user");
    if (firstUserMessage) {
      console.log("caching first user message");
      this.cacheLastContent(firstUserMessage);
    }

    if (hasTwoUserMesages) {
      // find the last two messages and mark them as ephemeral
      const lastTwoUserMessages = groupedMessages
        .filter((m) => m.role === "user")
        .slice(-2);

      for (const m of lastTwoUserMessages) {
        if (Array.isArray(m.content)) {
          console.log("caching user message");
          this.cacheLastContent(m);
        }
      }
    }
  }

  transformMessages(messages: Message[]): Anthropic.MessageParam[] {
    const toolCalls = messages.flatMap((msg) => msg.tool_calls || []);
    const claudeMessages: CachedMessageParam[] = messages
      .filter((msg) => msg.role !== "system")
      .filter((msg) => msg.content)
      .map((msg) => {
        if (msg.role === "tool") {
          const toolCall = toolCalls.find((tc) => tc.id === msg.tool_call_id);
          const toolMessages = [] as CachedMessageParam[];
          if (!toolCall) {
            console.log(
              "Tool call not found for message",
              JSON.stringify(msg, null, 2)
            );
          } else {
            toolMessages.push({
              role: "assistant",
              content: [
                {
                  type: "tool_use",
                  id: msg.tool_call_id,
                  name: toolCall.function.name,
                  input: JSON.parse(toolCall.function.arguments),
                },
              ],
            });
          }

          toolMessages.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                content: msg.content,
                tool_use_id: msg.tool_call_id,
              },
            ],
          });

          return toolMessages;
        }

        return {
          content: msg.content,
          role: msg.role === "system" ? "assistant" : msg.role,
        };
      })
      .flat();

    const groupedMessages = this.combineMessages(claudeMessages);

    this.handleMessageCaching(groupedMessages);

    return groupedMessages;
  }

  async createChatCompletion(
    options: CompletionOptions
  ): Promise<CompletionResponse> {
    const systemMessage = options.messages
      .filter((msg) => msg.role === "system")
      .map((msg) => msg.content || "")
      .join("\n");

    const claudeMessages = this.transformMessages(options.messages);
    console.log(JSON.stringify({ claudeMessages }, null, 2));

    const tools = this.transformTools(options.tools);
    const response = await this.beta.promptCaching.messages.create({
      model: options.model,
      messages: claudeMessages,
      system: systemMessage
        ? [
            {
              text: systemMessage,
              // cache_control: { type: "ephemeral" },
              type: "text",
            },
          ]
        : undefined,
      max_tokens: options.max_tokens || 4096,
      ...(tools.length && {
        tool_choice: { type: "auto" },
        tools,
      }),
    });

    return {
      choices: response.content.map((c) => {
        if (c.type === "tool_use") {
          return {
            message: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: c.id,
                  type: "function",
                  function: {
                    name: c.name,
                    arguments: JSON.stringify(c.input),
                  },
                },
              ],
            },
          };
        } else {
          return {
            message: {
              role: "assistant",
              content: c.text,
              tool_calls: [],
            },
          };
        }
      }),
    };
  }
}

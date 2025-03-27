import OpenAI from "openai";
import { getConfigSync } from "../config";
import { GenericClient, CompletionOptions, CompletionResponse } from "./types";
import {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat";

import { OpenAiReasoningModels } from "../types";

const config = getConfigSync();

export class GenericOpenAiClient extends OpenAI implements GenericClient {
  constructor() {
    super({
      apiKey: process.env.OPENAI_KEY,
      ...(config.openaiBaseUrl && { baseURL: config.openaiBaseUrl }),
    });
  }

  async createChatCompletion(
    options: CompletionOptions
  ): Promise<CompletionResponse> {
    const openaiMessages = options.messages.map((msg) => {
      if (msg.role === "tool") {
        return {
          ...msg,
          content: msg.content || "",
          role: "tool",
          tool_call_id: msg.tool_call_id,
        } as ChatCompletionToolMessageParam;
      }
      return msg as ChatCompletionMessageParam;
    });

    const response = await this.chat.completions.create({
      model: options.model,
      messages: openaiMessages,
      max_tokens: options.max_tokens,
      ...(OpenAiReasoningModels.includes(options.model) && {
        max_tokens: undefined,
        max_completion_tokens: options.max_tokens,
      }),

      ...(options.tools && {
        tools: options.tools,
        tool_choice: "auto",
      }),
    });

    console.log(JSON.stringify({ response }, null, 2));
    return {
      choices: response.choices.map((choice) => ({
        message: {
          role: choice.message?.role || "assistant",
          content: choice.message?.content || null,
          tool_calls: choice.message?.tool_calls
            ? choice.message.tool_calls
            : undefined,
        },
      })),
    };
  }
}

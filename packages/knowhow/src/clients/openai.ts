import OpenAI from "openai";
import { getConfigSync } from "../config";
import { GenericClient, CompletionOptions, CompletionResponse } from "./types";
import {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat";

import { Models, OpenAiReasoningModels } from "../types";

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
    const usdCost = this.calculateCost(options.model, response.usage);
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

      model: options.model,
      usage: response.usage,
      usd_cost: usdCost,
    };
  }

  pricesPerMillion() {
    return {
      [Models.openai.GPT_4o]: {
        input: 2.5,
        cached_input: 1.25,
        output: 10.0,
      },
      [Models.openai.GPT_4oMini]: {
        input: 0.15,
        cached_input: 0.075,
        output: 0.6,
      },
      [Models.openai.o1]: {
        input: 15.0,
        cached_input: 7.5,
        output: 60.0,
      },
      [Models.openai.o1_Mini]: {
        input: 1.1,
        cached_input: 0.55,
        output: 4.4,
      },
      [Models.openai.o3_Mini]: {
        input: 1.1,
        cached_input: 0.55,
        output: 4.4,
      },
      [Models.openai.GPT_4_5]: {
        input: 75.0,
        cached_input: 37.5,
        output: 150.0,
      },
      [Models.openai.GPT_4Turbo]: {
        input: 10,
        cached_input: 0,
        output: 30,
      },
    };
  }

  calculateCost(
    model: string,
    usage: OpenAI.ChatCompletion["usage"]
  ): number | undefined {
    const pricing = this.pricesPerMillion()[model];

    console.log({ pricing });
    if (!pricing) {
      return undefined;
    }

    const cachedInputTokens = usage.prompt_tokens_details.cached_tokens;
    const cachedInputCost = (cachedInputTokens * pricing.cached_input) / 1e6;

    const inputTokens = usage.prompt_tokens;
    const inputCost = ((inputTokens - cachedInputCost) * pricing.input) / 1e6;

    const outputTokens = usage.completion_tokens;
    const outputCost = (outputTokens * pricing.output) / 1e6;

    const total = cachedInputCost + inputCost + outputCost;
    console.log({ total });
    return total;
  }
}

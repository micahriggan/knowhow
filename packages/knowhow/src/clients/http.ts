import axios from "axios";
import {
  GenericClient,
  CompletionOptions,
  CompletionResponse,
  EmbeddingOptions,
  EmbeddingResponse,
} from "./types";

export class HttpClient implements GenericClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async createChatCompletion(
    options: CompletionOptions
  ): Promise<CompletionResponse> {
    const response = await axios.post(`${this.baseUrl}/v1/chat/completions`, {
      model: options.model,
      messages: options.messages,
      max_tokens: options.max_tokens,
      tools: options.tools,
      tool_choice: options.tool_choice,
    });

    const data = response.data;

    return {
      choices: data.choices.map((choice: any) => ({
        message: {
          role: choice.message.role,
          content: choice.message.content,
          tool_calls: choice.message.tool_calls,
        },
      })),
      model: data.model,
      usage: data.usage,
      usd_cost: data.usd_cost,
    };
  }

  async createEmbedding(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    const response = await axios.post(`${this.baseUrl}/v1/embeddings`, {
      model: options.model,
      input: options.input,
    });

    const data = response.data;

    return {
      data: data.data,
      model: options.model,
      usage: data.usage,
      usd_cost: data.usd_cost,
    };
  }

  async getModels() {
    const response = await axios.get(`${this.baseUrl}/v1/models`);
    const data = response.data;

    return data.data.map((model: any) => ({
      id: model.id,
      object: model.object,
      owned_by: model.owned_by,
    }));
  }
}

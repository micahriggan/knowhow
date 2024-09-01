import { CompletionOptions, CompletionResponse, GenericClient } from "./types";
import { GenericOpenAiClient } from "./openai";
import { GenericAnthropicClient } from "./anthropic";

export class AIClient {
  clients = {
    openai: GenericOpenAiClient,
    anthropic: GenericAnthropicClient,
  };

  getClient(provider: string): GenericClient {
    const Client = this.clients[provider];
    if (!Client) throw new Error("Invalid provider");
    return new Client();
  }

  async createCompletion(
    provider: string,
    options: CompletionOptions
  ): Promise<CompletionResponse> {
    const client = this.getClient(provider);
    return client.createChatCompletion(options);
  }
}

export const Clients = new AIClient();

export * from "./types";

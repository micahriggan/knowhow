import { CompletionOptions, CompletionResponse, GenericClient } from "./types";
import { GenericOpenAiClient } from "./openai";
import { GenericAnthropicClient } from "./anthropic";
import { Models } from "../ai";

export class AIClient {
  clients = {
    openai: GenericOpenAiClient,
    anthropic: GenericAnthropicClient,
  };

  clientModels = {
    openai: Models.openai,
    anthropic: Models.anthropic,
  };

  getClient(provider: string): GenericClient {
    const Client = this.clients[provider];
    if (!Client) throw new Error("Invalid provider");
    return new Client();
  }

  registerClient(provider: string, client: GenericClient) {
    this.clients[provider] = client;
  }

  registerModels(provider: string, models: string[]) {
    const currentModels = this.clientModels[provider] || [];
    this.clientModels[provider] = Array.from(
      new Set(currentModels.concat(models))
    );
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

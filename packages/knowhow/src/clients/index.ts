import { CompletionOptions, CompletionResponse, GenericClient } from "./types";
import { GenericOpenAiClient } from "./openai";
import { GenericAnthropicClient } from "./anthropic";
import { HttpClient } from "./http";
import { Models } from "../types";
import { getConfig } from "../config";

export class AIClient {
  clients = {
    openai: new GenericOpenAiClient(),
    anthropic: new GenericAnthropicClient(),
  };

  clientModels = {
    openai: Object.values(Models.openai),
    anthropic: Object.values(Models.anthropic),
  };

  getClient(provider: string): GenericClient {
    const Client = this.clients[provider];
    if (!Client) throw new Error("Invalid provider");
    return Client;
  }

  registerClient(provider: string, client: GenericClient) {
    this.clients[provider] = client;
  }

  async registerConfiguredModels() {
    const config = await getConfig();
    const modelProviders = config.modelProviders || [];

    for (const modelProvider of modelProviders) {
      const client = new HttpClient(modelProvider.url);

      this.registerClient(modelProvider.provider, client);

      const models = await client.getModels();
      const ids = models.map((model) => model.id);
      this.registerModels(modelProvider.provider, ids);
    }
  }

  registerModels(provider: string, models: string[]) {
    const currentModels = this.clientModels[provider] || [];
    this.clientModels[provider] = Array.from<string>(
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

  getRegisteredModels(provider: string): string[] {
    return this.clientModels[provider] || [];
  }
}

export const Clients = new AIClient();

export * from "./types";

export * from "./http";

import {
  CompletionOptions,
  CompletionResponse,
  EmbeddingOptions,
  EmbeddingResponse,
  GenericClient,
} from "./types";
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

      try {
        const models = await client.getModels();
        const ids = models.map((model) => model.id);
        this.registerModels(modelProvider.provider, ids);
      } catch (error) {
        console.error(
          `Failed to register models for provider ${modelProvider.provider}:`
        );
      }
    }
  }

  registerModels(provider: string, models: string[]) {
    const currentModels = this.clientModels[provider] || [];
    this.clientModels[provider] = Array.from<string>(
      new Set(currentModels.concat(models))
    );
  }

  private providerHasModel(provider: string, model: string): boolean {
    const models = this.clientModels[provider];
    if (!models) return false;
    return models.includes(model);
  }

  private detectProviderModel(provider: string, model: string) {
    if (this.providerHasModel(provider, model)) {
      return { provider, model };
    }

    if (model.includes("/")) {
      const split = model.split("/");

      const inferredProvider = split[0];
      const inferredModel = split.slice(1).join("/");

      if (this.providerHasModel(inferredProvider, inferredModel)) {
        return { provider: inferredProvider, model: inferredModel };
      }
    }

    const providers = Object.keys(this.clientModels);
    const foundProvider = providers.find((p) =>
      this.providerHasModel(p, model)
    );

    if (foundProvider) {
      return { provider: foundProvider, model };
    }

    return { provider, model };
  }

  async createCompletion(
    provider: string,
    options: CompletionOptions
  ): Promise<CompletionResponse> {
    const detected = this.detectProviderModel(provider, options.model);

    provider = detected.provider;
    options.model = detected.model;

    if (!this.clients[provider]) {
      throw new Error(
        `Provider ${provider} not registered. Available providers: ${Object.keys(
          this.clients
        )}`
      );
    }

    const hasModel = this.providerHasModel(provider, options.model);

    if (!hasModel) {
      const doesHave = Object.keys(this.clientModels).filter((key) =>
        this.providerHasModel(key, options.model)
      );

      if (doesHave.length) {
        throw new Error(
          `Model ${options.model} not registered for provider ${provider}. ${doesHave} has model ${options.model}`
        );
      } else {
        throw new Error(
          `Model ${
            options.model
          } not registered for any provider. ${JSON.stringify(
            this.clientModels,
            null,
            2
          )} are the available models`
        );
      }
    }

    const client = this.getClient(provider);
    return client.createChatCompletion(options);
  }

  async createEmbedding(
    provider: string,
    options: EmbeddingOptions
  ): Promise<EmbeddingResponse> {
    const detected = this.detectProviderModel(provider, options.model);

    provider = detected.provider;
    options.model = detected.model;

    if (!this.clients[provider]) {
      throw new Error(
        `Provider ${provider} not registered. Available providers: ${Object.keys(
          this.clients
        )}`
      );
    }

    const hasModel = this.providerHasModel(provider, options.model);

    if (!hasModel) {
      throw new Error(
        `Model ${options.model} not registered for provider ${provider}.`
      );
    }

    const client = this.getClient(provider);
    return client.createEmbedding(options);
  }

  getRegisteredModels(provider: string): string[] {
    return this.clientModels[provider] || [];
  }

  listAllModels() {
    return this.clientModels;
  }

  listAllProviders() {
    return Object.keys(this.clientModels);
  }
}

export const Clients = new AIClient();

export * from "./types";

export * from "./http";

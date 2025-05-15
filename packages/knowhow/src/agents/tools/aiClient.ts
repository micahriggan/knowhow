import { Clients } from "../../clients";
import {
  GenericClient,
  CompletionOptions,
  CompletionResponse,
  EmbeddingOptions,
  EmbeddingResponse,
} from "../../clients/types";

export function createAiCompletion(
  provider: string,
  options: CompletionOptions
): Promise<CompletionResponse> {
  return Clients.createCompletion(provider, options);
}

export function createEmbedding(
  provider: string,
  options: EmbeddingOptions
): Promise<EmbeddingResponse> {
  return Clients.createEmbedding(provider, options);
}

export async function listModelsForProvider(
  provider: string
): Promise<string[]> {
  return Clients.getRegisteredModels(provider);
}

export async function listAllModels(): Promise<Record<string, string[]>> {
  return Clients.listAllModels();
}

export async function listAllProviders(): Promise<string[]> {
  return Clients.listAllProviders();
}

import { AssistantTool } from "openai/resources/beta";
import { WebSocket } from "ws";

export type Hashes = {
  [file: string]: {
    [promptHash: string]: string;

    promptHash: string;
    fileHash: string;
  };
};

export type GenerationSource = {
  model?: string;
  agent?: string;
  input: string;
  output: string;
  prompt: string;
  kind?: string;
  outputExt?: string;
  outputName?: string;
};

export type EmbedSource = {
  input: string;
  output: string;
  prompt?: string;
  kind?: string;
  uploadMode?: boolean;
  remote?: string;
  remoteType?: string;
  remoteId?: string;
  chunkSize?: number;
  minLength?: number;
};

export type Config = {
  openaiBaseUrl?: string;
  promptsDir: string;
  lintCommands?: { [fileExtension: string]: string };

  micCommand?: string;
  defaultMic?: string;

  sources: GenerationSource[];
  embedSources: EmbedSource[];
  embeddingModel: string;

  plugins: string[];
  modules: string[];

  agents: Assistant[];
  mcps: McpConfig[];
  modelProviders: ModelProvider[];

  worker?: {
    allowedTools?: string[];
  };
};

export type Assistant = {
  name?: string;
  description?: string;
  instructions: string;
  model?: string;
  provider?: keyof typeof Providers;
};

export type McpConfig = {
  name: string;
  command?: string;
  url?: string;
  args?: string[];
  env?: { [key: string]: string };
  params?: Partial<{ socket: WebSocket }>;
};

export type ModelProvider = {
  url: string;
  provider: string;
};

export type AssistantConfig = {
  files: { [filepath: string]: string };
};

export interface Embeddable<T = any> {
  id: string;
  text: string;
  vector: number[];
  metadata: T;
}

export type MinimalEmbedding<T = any> = Pick<
  Embeddable<T>,
  "id" | "text" | "metadata"
>;

export interface EmbeddingBase<T = any> extends Embeddable<T> {
  similarity?: number;
}

export type GptQuestionEmbedding = any & EmbeddingBase;

export type DatasourceType = "file" | "url" | "text";

export interface IDatasource {
  kind: string;
  data: string[];
}

export type Language = {
  [term: string]: {
    sources: IDatasource[];
    context?: string;
  };
};

export type ChatInteraction = {
  input: string;
  output: string;
  summaries: string[];
  lastThread: string[];
};

export const Providers = {
  anthropic: "anthropic",
  openai: "openai",
} as { [key in keyof typeof Models]: keyof typeof Models };

export const Models = {
  anthropic: {
    Sonnet: "claude-3-5-sonnet-20240620",
    Sonnet3_7: "claude-3-7-sonnet-20250219",
  },
  openai: {
    GPT_41: "gpt-4.1-2025-04-14",
    GPT_41_Mini: "gpt-4.1-mini-2025-04-14",
    GPT_41_Nano: "gpt-4.1-nano-2025-04-14",
    GPT_45: "gpt-4.5-preview-2025-02-27",
    GPT_4o: "gpt-4o-2024-08-06",
    GPT_4o_Audio: "gpt-4o-audio-preview-2024-12-17",
    GPT_4o_Realtime: "gpt-4o-realtime-preview-2024-12-17",
    GPT_4o_Mini: "gpt-4o-mini-2024-07-18",
    GPT_4o_Mini_Audio: "gpt-4o-mini-audio-preview-2024-12-17",
    GPT_4o_Mini_Realtime: "gpt-4o-mini-realtime-preview-2024-12-17",
    o1: "o1-2024-12-17",
    o1_Pro: "o1-pro-2025-03-19",
    o3: "o3-2025-04-16",
    o4_Mini: "o4-mini-2025-04-16",
    o3_Mini: "o3-mini-2025-01-31",
    o1_Mini: "o1-mini-2024-09-12",
    GPT_4o_Mini_Search: "gpt-4o-mini-search-preview-2025-03-11",
    GPT_4o_Search: "gpt-4o-search-preview-2025-03-11",
    Computer_Use: "computer-use-preview-2025-03-11",

    EmbeddingAda2: "text-embedding-ada-002",
    EmbeddingLarge3: "text-embedding-3-large",
    EmbeddingSmall3: "text-embedding-3-small",
  },
};

export const OpenAiReasoningModels = [
  Models.openai.o1,
  Models.openai.o1_Mini,
  Models.openai.o3_Mini,
  Models.openai.o3,
  Models.openai.o4_Mini,
];

export const OpenAiEmbeddingModels = [
  Models.openai.EmbeddingAda2,
  Models.openai.EmbeddingLarge3,
  Models.openai.EmbeddingSmall3,
];

import { AssistantTool } from "openai/resources/beta";
import { WebSocket } from "ws";

export type Hashes = {
  [file: string]: {
    [promptHash: string]: string;

    promptHash: string;
    fileHash: string;
  };
};
export type Config = {
  openaiBaseUrl?: string;
  promptsDir: string;
  lintCommands?: { [fileExtension: string]: string };

  micCommand?: string;
  defaultMic?: string;

  sources: {
    model?: string;
    input: string;
    output: string;
    prompt: string;
    kind?: string;
    outputExt?: string;
    outputName?: string;
  }[];

  embedSources: {
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
  }[];

  plugins: string[];
  modules: string[];

  agents: Assistant[];
  mcps: McpConfig[];
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
    GPT_4Turbo: "gpt-4-turbo-2024-04-09",
    GPT_4o: "gpt-4o-2024-08-06",
    GPT_4oMini: "gpt-4o-mini-2024-07-18",
    o3_Mini: "o3-mini-2025-01-31",
    o1: "o1-2024-12-17",
    o1_Mini: "o1-mini-2024-09-12",
    GPT_4_5: "gpt-4.5-preview-2025-02-27",
  },
};

export const OpenAiReasoningModels = [
  Models.openai.o1,
  Models.openai.o1_Mini,
  Models.openai.o3_Mini,
];

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
    chunkSize?: number;
    minLength?: number;
  }[];

  plugins: string[];
  modules: string[];

  assistants: Assistant[];
};

export type Assistant = {
  id?: string;
  name?: string;
  description?: string;
  instructions: string;
  model: string;
  tools: { type: "code_interpreter" | "retrieval" }[];
  files: string[];
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

export const Models = {
  anthropic: {
    Sonnet: "claude-3-5-sonnet-20240620",
    Sonnet3_7: "claude-3-7-sonnet-20250219",
  },
  openai: {
    GPT_4Turbo: "gpt-4-turbo-2024-04-09",
    GPT_4o: "gpt-4o-2024-08-06",
    GPT_4oMini: "gpt-4o-mini-2024-07-18",
  },
};

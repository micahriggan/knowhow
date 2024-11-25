export type Hashes = {
  [key: string]: {
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
    input: string;
    output: string;
    prompt: string;
    kind?: string;
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

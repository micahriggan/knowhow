export type Hashes = {
  [key: string]: {
    promptHash: string;
    fileHash: string;
  };
};
export type Config = {
  promptsDir: string;
  sources: Array<{
    input: string;
    output: string;
    prompt: string;
  }>;

  embedSources: Array<{
    input: string;
    output: string;
    prompt?: string;
    uploadMode?: boolean;
    chunkSize?: number;
  }>;

  embedJsonSources: Array<{
    input: string;
    output: string;
    prompt?: string;
  }>;
  plugins: Array<string>;

  assistants: Array<Assistant>;
};

export type Assistant = {
  id?: string;
  name?: string;
  description?: string;
  instructions: string;
  model: string;
  tools: Array<{ type: "code_interpreter" | "retrieval" }>;
  files: Array<string>;
};

export type AssistantConfig = {
  files: { [filepath: string]: string };
};

export interface Embeddable<T = any> {
  id: string;
  text: string;
  vector: Array<number>;
  metadata: T;
}

export type EmbeddingBase = {
  vector?: Array<number>;
  similarity?: number;
};

export type GptQuestionEmbedding = any & EmbeddingBase;

export type DatasourceType = "file" | "url" | "text";

export interface IDatasource {
  kind: string;
  data: Array<string>;
}

export type Language = {
  [term: string]: {
    sources: Array<IDatasource>;
    context?: string;
  };
};

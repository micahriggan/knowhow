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
  }>;

  embedJsonSources: Array<{
    input: string;
    output: string;
    prompt?: string;
  }>;
};

export interface Embeddable<T = any> {
  id: string;
  text: string;
  metadata: T;
}

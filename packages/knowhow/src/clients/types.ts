export type MessageContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | MessageContent[];

  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface OutputMessage extends Message {
  content: string;
}

export interface ToolProp {
  type: string;
  description: string;
  properties?: { [key: string]: ToolProp };
  items?: ToolProp;
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      positional?: boolean;
      properties: {
        [key: string]: ToolProp;
      };
      required: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface CompletionOptions {
  model: string;
  messages: Message[];
  tools?: Tool[];
  tool_choice?: "auto" | "none";
  max_tokens?: number;
}

export interface CompletionResponse {
  choices: {
    message: OutputMessage;
  }[];

  model: string;
  usage: any;
  usd_cost?: number;
}

export interface GenericClient {
  createChatCompletion(options: CompletionOptions): Promise<CompletionResponse>;
  getModels(): Promise<{ id: string }[]>;
}

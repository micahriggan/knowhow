export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
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
    message: Message;
  }[];

  model: string;
  usage: any;
  usd_cost?: number;
}

export interface GenericClient {
  createChatCompletion(options: CompletionOptions): Promise<CompletionResponse>;
}

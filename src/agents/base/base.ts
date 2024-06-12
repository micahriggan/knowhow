import {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat";
import { openai } from "../../ai";
import {
  addInternalTools,
  callPlugin,
  execCommand,
  finalAnswer,
  readBlocks,
  readFile,
  embeddingSearch,
  visionTool,
  lintFile,
  textSearch,
} from "../tools";
import { Tools } from "../tools/list";
import { patchFile } from "../tools/patch";
import { IAgent } from "../interface";

const availableFunctions = addInternalTools({
  patchFile,
  callPlugin,
  execCommand,
  finalAnswer,
  readBlocks,
  readFile,
  embeddingSearch,
  visionTool,
  lintFile,
  textSearch,
});

export abstract class BaseAgent implements IAgent {
  abstract name: string;

  protected gptModelName: string = "gpt-4-turbo-preview";

  getModel(): string {
    return this.gptModelName;
  }

  setModel(value: string) {
    this.gptModelName = value;
  }

  disabledTools = [];

  getEnabledTools() {
    return Tools.getTools().filter(
      (t) => !this.disabledTools.includes(t.function.name)
    );
  }

  disableTool(toolName: string) {
    this.disabledTools.push(toolName);
  }

  isToolEnabled(toolName: string) {
    return !!this.getEnabledTools().find((t) => t.function.name === toolName);
  }

  enableTool(toolName: string) {
    if (!this.isToolEnabled(toolName)) {
      this.disabledTools = this.disabledTools.filter((t) => t !== toolName);
    }
  }

  abstract getInitialMessages(userInput: string): ChatCompletionMessageParam[];

  async getToolMessages(toolCall: ChatCompletionMessageToolCall) {
    const functionName = toolCall.function.name;
    const functionToCall = availableFunctions[functionName];
    const functionArgs = JSON.parse(toolCall.function.arguments);

    const toJsonIfObject = (arg: any) => {
      if (typeof arg === "object") {
        return JSON.stringify(arg, null, 2);
      }
      return arg;
    };

    const toolDefinition = Tools.getTool(functionName);
    const properties = toolDefinition?.function?.parameters?.properties || {};
    const positionalArgs = Object.keys(properties).map((p) => functionArgs[p]);

    console.log(
      `Calling function ${functionName} with args:`,
      JSON.stringify(positionalArgs, null, 2)
    );

    if (!functionToCall) {
      const options = Object.keys(availableFunctions).join(", ");
      return [
        {
          tool_call_id: toolCall.id,
          role: "tool",
          name: "error",
          content: `Function ${functionName} not found, options are ${options}`,
        },
      ];
    }

    const functionResponse = await Promise.resolve(
      functionToCall(...positionalArgs)
    ).catch((e) => e.message);
    let toolMessages = [];

    if (functionName === "multi_tool_use.parallel") {
      const args = positionalArgs[0] as {
        recipient_name: string;
        parameters: any;
      }[];

      toolMessages = args.map((call, index) => {
        return {
          tool_call_id: toolCall.id + "_" + index,
          role: "tool",
          name: call.recipient_name.split(".").pop(),
          content: toJsonIfObject(functionResponse[index]) || "Done",
        };
      });
    }

    toolMessages = [
      {
        tool_call_id: toolCall.id,
        role: "tool",
        name: functionName,
        content: toJsonIfObject(functionResponse) || "Done",
      },
    ];

    console.log(toolMessages);

    return toolMessages;
  }

  logMessages(messages: ChatCompletionMessageParam[]) {
    for (const message of messages) {
      if (message.role === "assistant") {
        console.log(message.content);
      }
    }
  }

  async call(userInput: string, _messages?: ChatCompletionMessageParam[]) {
    const model = this.getModel();
    let messages = _messages || this.getInitialMessages(userInput);

    const startIndex = 0;
    const endIndex = messages.length;
    const compressThreshold = 7;

    const response = await openai.chat.completions.create({
      model,
      messages,
      tools: this.getEnabledTools(),
      tool_choice: "auto",
    });
    this.logMessages(response.choices.map((c) => c.message));
    const responseMessage = response.choices[0].message;

    const toolCalls = responseMessage.tool_calls;
    if (responseMessage.tool_calls) {
      // extend conversation with assistant's reply
      messages.push(responseMessage);

      for (const toolCall of toolCalls) {
        const toolMessages = await this.getToolMessages(toolCall);
        // Add the tool responses to the thread
        messages.push(...(toolMessages as ChatCompletionToolMessageParam[]));

        const finalMessage = toolMessages.find((m) => m.name === "finalAnswer");
        if (finalMessage) {
          return finalMessage.content;
        }
      }

      if (messages.length > compressThreshold) {
        messages = await this.compressMessages(messages, startIndex, endIndex);
      }

      // Send the tool responses back to the model
      const secondResponse = await openai.chat.completions.create({
        model,
        messages,
      });

      const aiResp = secondResponse.choices.map((c) => c.message);
      this.logMessages(aiResp);
      messages.push(...aiResp);

      return this.call(userInput, messages);
    }

    if (responseMessage.content) {
      return responseMessage.content;
    }
  }

  async compressMessages(
    messages: ChatCompletionMessageParam[],
    startIndex: number,
    endIndex: number
  ) {
    const toCompress = messages.slice(startIndex, endIndex);
    const toCompressPrompt = `Summarize what this agent was tasked with, what has been tried so far, and what we're about to do next. This summary will become the agent's only memory of the past, all other messages will be dropped: \n\n${JSON.stringify(
      toCompress
    )}`;

    const model = this.getModel();

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "assistant",
          content: toCompressPrompt,
        },
      ],
    });

    const newMessages = [
      ...response.choices.map((c) => c.message),
      ...messages.slice(endIndex),
    ];

    const oldLength = JSON.stringify(messages).length;
    const newLength = JSON.stringify(newMessages).length;
    const compressionRatio = (
      ((oldLength - newLength) / oldLength) *
      100
    ).toFixed(2);

    console.log(
      "Compressed messages from",
      oldLength,
      "to",
      newLength,
      compressionRatio + "%",
      "reduction in size"
    );

    return newMessages;
  }
}

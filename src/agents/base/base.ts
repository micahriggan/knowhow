import {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat";
import { openai } from "../../ai";
import { IAgent } from "../interface";
import { ToolsService, Tools } from "../../services/Tools";
import { replaceEscapedNewLines, restoreEscapedNewLines } from "../../utils";
import { $Command } from "@aws-sdk/client-s3";

export abstract class BaseAgent implements IAgent {
  abstract name: string;

  protected gptModelName: string = "gpt-4-turbo-preview";

  constructor(public tools: ToolsService = Tools) {}

  getModel(): string {
    return this.gptModelName;
  }

  setModel(value: string) {
    this.gptModelName = value;
  }

  disabledTools = [];

  getEnabledTools() {
    return this.tools
      .getTools()
      .filter((t) => !this.disabledTools.includes(t.function.name));
  }

  getEnabledToolNames() {
    return this.getEnabledTools().map((t) => t.function.name);
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

  abstract getInitialMessages(
    userInput: string
  ): Promise<ChatCompletionMessageParam[]>;

  async processToolMessages(toolCall: ChatCompletionMessageToolCall) {
    const functionName = toolCall.function.name;
    const functionToCall = this.tools.getFunction(functionName);

    console.log(toolCall);
    const functionArgs = JSON.parse(
      this.formatAiResponse(toolCall.function.arguments)
    );

    const toJsonIfObject = (arg: any) => {
      if (typeof arg === "object") {
        return JSON.stringify(arg, null, 2);
      }
      return arg;
    };

    const toolDefinition = this.tools.getTool(functionName);
    const properties = toolDefinition?.function?.parameters?.properties || {};
    const positionalArgs = Object.keys(properties).map((p) => functionArgs[p]);

    console.log(
      `Calling function ${functionName} with args:`,
      JSON.stringify(positionalArgs, null, 2)
    );

    if (!functionToCall) {
      const options = this.getEnabledToolNames().join(", ");
      const error = `Function ${functionName} not found, options are ${options}`;
      console.log(error);
      return [
        {
          tool_call_id: toolCall.id,
          role: "tool",
          name: "error",
          content: error,
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

  formatInputContent(userInput: string) {
    return replaceEscapedNewLines(userInput);
  }

  formatAiResponse(response: string) {
    return restoreEscapedNewLines(response);
  }

  formatInputMessages(messages: ChatCompletionMessageParam[]) {
    return messages.map((m) => ({
      ...m,
      content:
        typeof m.content === "string"
          ? this.formatInputContent(m.content)
          : m.content,
    })) as ChatCompletionMessageParam[];
  }

  formatOutputMessages(messages: ChatCompletionMessageParam[]) {
    return messages.map((m) => ({
      ...m,
      content:
        typeof m.content === "string"
          ? this.formatAiResponse(m.content)
          : m.content,
    })) as ChatCompletionMessageParam[];
  }

  async call(userInput: string, _messages?: ChatCompletionMessageParam[]) {
    const model = this.getModel();
    let messages = _messages || (await this.getInitialMessages(userInput));
    messages = this.formatInputMessages(messages);

    const startIndex = 0;
    const endIndex = messages.length;
    const compressThreshold = 30000;

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
        const toolMessages = await this.processToolMessages(toolCall);
        // Add the tool responses to the thread
        messages.push(...(toolMessages as ChatCompletionToolMessageParam[]));

        const finalMessage = toolMessages.find((m) => m.name === "finalAnswer");
        if (finalMessage) {
          return finalMessage.content;
        }
      }

      if (this.getMessagesLength(messages) > compressThreshold) {
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

  getMessagesLength(messages: ChatCompletionMessageParam[]) {
    return JSON.stringify(messages).split(" ").length;
  }

  async compressMessages(
    messages: ChatCompletionMessageParam[],
    startIndex: number,
    endIndex: number
  ) {
    const toCompress = messages.slice(startIndex, endIndex);
    const toCompressPrompt = `Summarize:
    1. Initial Request - what this agent was tasked with.
    2. Progress - what has been tried so far,
    3. Next Steps - what we're about to do next to continue the user's original request.

      This summary will become the agent's only memory of the past, all other messages will be dropped: \n\n${JSON.stringify(
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

    const systemMesasges = toCompress.filter((m) => m.role === "system");

    const newMessages = [
      ...systemMesasges,
      ...response.choices.map((c) => c.message),
      ...messages.slice(endIndex),
    ];

    const oldLength = this.getMessagesLength(messages);
    const newLength = this.getMessagesLength(newMessages);
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

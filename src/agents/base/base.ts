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
  searchFiles,
  visionTool,
  lintFile,
  textSearch,
} from "../tools";
import { Tools } from "../tools/list";
import { patchFile } from "../tools/patch";

const availableFunctions = addInternalTools({
  patchFile,
  callPlugin,
  execCommand,
  finalAnswer,
  readBlocks,
  readFile,
  searchFiles,
  visionTool,
  lintFile,
  textSearch,
});

export interface IAgent {
  name: string;
  call: (
    userInput: string,
    messages?: ChatCompletionMessageParam[]
  ) => Promise<string>;
}

export abstract class BaseAgent implements IAgent {
  abstract name: string;

  enabledTools = [...Tools];

  disableTool(toolName: string) {
    this.enabledTools = this.enabledTools.filter(
      (t) => t.function.name !== toolName
    );
  }

  isToolEnabled(toolName: string) {
    return !!this.enabledTools.find((t) => t.function.name === toolName);
  }

  enableTool(toolName: string) {
    if (!this.isToolEnabled(toolName)) {
      this.enabledTools = this.enabledTools.concat(
        Tools.filter((t) => t.function.name === toolName)
      );
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

    const toolDefinition = Tools.find((t) => t.function.name === functionName);
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
    const model = "gpt-4o";
    const messages = _messages || this.getInitialMessages(userInput);

    const response = await openai.chat.completions.create({
      model,
      messages,
      tools: this.enabledTools,
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
}

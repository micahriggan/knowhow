import {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat";
import { openai } from "../../ai";
import {
  addInternalTools,
  applyPatchFile,
  callPlugin,
  execCommand,
  finalAnswer,
  readBlocks,
  readFile,
  searchFiles,
  visionTool,
  modifyFile,
} from "../tools";
import { Tools } from "../tools/list";

const availableFunctions = addInternalTools({
  applyPatchFile,
  callPlugin,
  execCommand,
  finalAnswer,
  readBlocks,
  readFile,
  searchFiles,
  visionTool,
  modifyFile,
});

export class CodebaseAgent {
  getInitialMessages(user_input: string) {
    return [
      {
        role: "system",
        content:
          "Codebase Agent. You use the tools to read and write code, to help the developer implement features faster. Call final answer once you have finished implementing what is requested. As an agent you will receive multiple rounds of input until you call final answer. You are not able to request feedback from the user, so proceed with your plans and the developer will contact you afterwards if they need more help. Use modifyFile to make partial edits to files. The edits should be the minimal changes to the existing files to achieve the goal. modifyFile is used to replace text in the numbered blocks. You can modify up to 5 lines per block, and you may send along multiple blocks at a time.",
      },

      { role: "user", content: user_input },
    ] as Array<ChatCompletionMessageParam>;
  }

  async getToolMessages(toolCall: ChatCompletionMessageToolCall) {
    const functionName = toolCall.function.name;
    const functionToCall = availableFunctions[functionName];
    const functionArgs = JSON.parse(toolCall.function.arguments);
    const positionalArgs = Object.values(functionArgs);

    const toJsonIfObject = (arg: any) => {
      if (typeof arg === "object") {
        return JSON.stringify(arg);
      }
      return arg;
    };

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
    const functionResponse = await functionToCall(...positionalArgs);

    if (functionName === "multi_tool_use.parallel") {
      const args = positionalArgs[0] as {
        recipient_name: string;
        parameters: any;
      }[];

      return args.map((call, index) => {
        return {
          tool_call_id: toolCall.id + "_" + index,
          role: "tool",
          name: call.recipient_name.split(".").pop(),
          content: toJsonIfObject(functionResponse[index]) || "Done",
        };
      });
    }

    const toolMessage = {
      tool_call_id: toolCall.id,
      role: "tool",
      name: functionName,
      content: toJsonIfObject(functionResponse) || "Done",
    };

    return [toolMessage];
  }

  logMessages(messages: Array<ChatCompletionMessageParam>) {
    for (const message of messages) {
      if (message.role == "assistant") {
        console.log(message.content);
      }
    }
  }

  async call(
    user_input: string,
    _messages?: Array<ChatCompletionMessageParam>
  ) {
    const model = "gpt-4-1106-preview";
    const messages = _messages || this.getInitialMessages(user_input);

    const response = await openai.chat.completions.create({
      model,
      messages: messages,
      tools: Tools,
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
        messages.push(
          ...(toolMessages as Array<ChatCompletionToolMessageParam>)
        );

        const finalMessage = toolMessages.find((m) => m.name === "finalAnswer");
        if (finalMessage) {
          return finalMessage.content;
        }
      }

      // Send the tool responses back to the model
      const secondResponse = await openai.chat.completions.create({
        model,
        messages: messages,
      });

      const aiResp = secondResponse.choices.map((c) => c.message);
      this.logMessages(aiResp);
      messages.push(...aiResp);

      return this.call(user_input, messages);
    }

    if (responseMessage.content) {
      return responseMessage.content;
    }
  }
}

export const Developer = new CodebaseAgent();

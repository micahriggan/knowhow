import {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat";
import { openai } from "../../ai";
import {
  searchFiles,
  scanFile,
  writeFile,
  applyPatchFile,
  execCommand,
  readFile,
  finalAnswer,
  addInternalTools,
} from "../tools";
import { Tools } from "../tools/list";

const availableFunctions = addInternalTools({
  searchFiles: searchFiles,
  readFile: readFile,
  scanFile: scanFile,
  writeFile: writeFile,
  applyPatchFile: applyPatchFile,
  execCommand: execCommand,
  finalAnswer: finalAnswer,
});

export class CodebaseAgent {
  messages = new Array<ChatCompletionMessageParam>();

  getInitialMessages(user_input: string) {
    return [
      {
        role: "system",
        content:
          "Codebase Agent. You use the tools to read and write code, to help the developer implement features faster. Call final answer once you have finished implementing what is requested. As an agent you will receive multiple rounds of input until you call final answer.",
      },

      { role: "user", content: user_input },
    ] as Array<ChatCompletionMessageParam>;
  }

  async useTool(toolCall: ChatCompletionMessageToolCall) {
    const functionName = toolCall.function.name;
    const functionToCall = availableFunctions[functionName];
    const functionArgs = JSON.parse(toolCall.function.arguments);
    const positionalArgs = Object.values(functionArgs);

    console.log(
      `Calling function ${functionName} with args:`,
      JSON.stringify(positionalArgs, null, 2)
    );

    const functionResponse = await functionToCall(...positionalArgs);
    const toolMessage = {
      tool_call_id: toolCall.id,
      role: "tool",
      name: functionName,
      content: functionResponse || "Done",
    };

    return toolMessage;
  }

  clear() {
    this.messages = [];
  }

  async call(
    user_input: string,
    _messages?: Array<ChatCompletionMessageParam>
  ) {
    const model = "gpt-4-1106-preview";

    if (this.messages.length === 0) {
      this.messages = _messages || this.getInitialMessages(user_input);
    }

    const response = await openai.chat.completions.create({
      model,
      messages: this.messages,
      tools: Tools,
      tool_choice: "auto",
    });
    const responseMessage = response.choices[0].message;
    console.log(responseMessage);

    const toolCalls = responseMessage.tool_calls;
    if (responseMessage.tool_calls) {
      // extend conversation with assistant's reply
      this.messages.push(responseMessage);

      for (const toolCall of toolCalls) {
        const toolMessage = await this.useTool(toolCall);
        // Add the tool responses to the thread
        this.messages.push(toolMessage as ChatCompletionToolMessageParam);

        if (toolMessage.name === "finalAnswer") {
          return toolMessage.content;
        }
      }

      // Send the tool responses back to the model
      const secondResponse = await openai.chat.completions.create({
        model,
        messages: this.messages,
      });

      const aiResp = secondResponse.choices.map((c) => c.message);
      console.log(aiResp);
      this.messages.push(...aiResp);

      return this.call(user_input, this.messages);
    }

    if (responseMessage.content) {
      return responseMessage.content;
    }
  }
}

export const Developer = new CodebaseAgent();

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
  callPlugin,
} from "../tools";
import { Tools } from "../tools/list";

const availableFunctions = addInternalTools({
  applyPatchFile,
  callPlugin,
  execCommand,
  finalAnswer,
  readFile,
  scanFile,
  searchFiles,
  writeFile,
});

export class CodebaseAgent {
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
    const responseMessage = response.choices[0].message;
    console.log(responseMessage);

    const toolCalls = responseMessage.tool_calls;
    if (responseMessage.tool_calls) {
      // extend conversation with assistant's reply
      messages.push(responseMessage);

      for (const toolCall of toolCalls) {
        const toolMessage = await this.useTool(toolCall);
        // Add the tool responses to the thread
        messages.push(toolMessage as ChatCompletionToolMessageParam);

        if (toolMessage.name === "finalAnswer") {
          return toolMessage.content;
        }
      }

      // Send the tool responses back to the model
      const secondResponse = await openai.chat.completions.create({
        model,
        messages: messages,
      });

      const aiResp = secondResponse.choices.map((c) => c.message);
      console.log(aiResp);
      messages.push(...aiResp);

      return this.call(user_input, messages);
    }

    if (responseMessage.content) {
      return responseMessage.content;
    }
  }
}

export const Developer = new CodebaseAgent();

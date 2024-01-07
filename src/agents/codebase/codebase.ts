import { ChatCompletionTool } from "openai/resources/chat";
import {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat";
import { openai } from "../../ai";
import * as fs from "fs";
import { exec } from "child_process";
import * as util from "util";
import { createPatch, applyPatch } from "diff";
import {
  searchFiles,
  scanFile,
  writeFile,
  createPatchFile,
  applyPatchFile,
  execCommand,
  readFile,
  finalAnswer,
} from "../tools";
import { Tools } from "../tools/list";

export class CodebaseAgent {
  async call(
    user_input: string,
    _messages?: Array<ChatCompletionMessageParam>
  ) {
    const model = "gpt-4-1106-preview";
    const messages =
      _messages ||
      ([
        {
          role: "system",
          content:
            "Codebase Agent. You use the tools to read and write code, to help the developer implement features faster. Call final answer once you have finished implementing what is requested. As an agent you will receive multiple rounds of input until you call final answer.",
        },

        { role: "user", content: user_input },
      ] as Array<ChatCompletionMessageParam>);

    console.log(
      "Sending user input to the model...",
      JSON.stringify(messages, null, 2)
    );
    const response = await openai.chat.completions.create({
      model,
      messages: messages,
      tools: Tools,
      tool_choice: "auto",
    });
    const responseMessage = response.choices[0].message;

    const toolCalls = responseMessage.tool_calls;
    if (responseMessage.tool_calls) {
      const availableFunctions = {
        searchFiles: searchFiles,
        readFile: readFile,
        scanFile: scanFile,
        writeFile: writeFile,
        createPatchFile: createPatchFile,
        applyPatchFile: applyPatchFile,
        execCommand: execCommand,
        finalAnswer: finalAnswer,
      };

      // extend conversation with assistant's reply
      messages.push(responseMessage);

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionToCall = availableFunctions[functionName];
        const functionArgs = JSON.parse(toolCall.function.arguments);
        const positionalArgs = Object.values(functionArgs);

        console.log(
          `Calling function ${functionName} with args:`,
          positionalArgs
        );

        const functionResponse = await functionToCall(...positionalArgs);
        const toolMessage = {
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          ...(functionResponse && { content: functionResponse }),
        } as ChatCompletionToolMessageParam;

        // Add the tool responses to the thread
        messages.push(toolMessage);

        if (functionName === "finalAnswer") {
          return functionResponse;
        }
      }

      // Send the tool responses back to the model
      console.log(
        "Sending tool responses back to the model...",
        JSON.stringify(messages, null, 2)
      );
      const secondResponse = await openai.chat.completions.create({
        model,
        messages: messages,
      });

      const aiResp = secondResponse.choices.map((c) => c.message);
      messages.push(...aiResp);

      return this.call(user_input, messages);
    }
  }
}

export const Developer = new CodebaseAgent();

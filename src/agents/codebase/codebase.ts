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
} from "../tools";

export class CodebaseAgent {
  async call(user_input: string) {
    const model = "gpt-4-1106-preview";
    const messages = [
      {
        role: "system",
        content:
          "Helpful Codebase assistant. Answer users questions using the embedding data that is provided with the user's question. You have limited access to the codebase based off of how similar the codebase is to the user's question. You may reference file paths by using the IDs present in the embedding data, but be sure to remove the chunk from the end of the filepaths.",
      },

      { role: "user", content: user_input },
    ] as Array<ChatCompletionMessageParam>;

    const tools = [
      {
        type: "function",
        function: {
          name: "searchFiles",
          description: "Search for files related to the user's goal",
          parameters: {
            type: "object",
            properties: {
              keyword: {
                type: "string",
                description:
                  "The keyword or phrase to search for via embedding search",
              },
            },
            required: ["keyword"],
          },
          returns: {
            type: "string",
            description: "A string containing a JSON of all the matched files",
          },
        },
      },
      {
        type: "function",
        function: {
          name: "readFile",
          description: "Read the contents of a file",
          parameters: {
            type: "object",
            properties: {
              filePath: {
                type: "string",
                description: "The path to the file to be read",
              },
            },
            required: ["filePath"],
          },
          returns: {
            type: "string",
            description: "The contents of the file as a string",
          },
        },
      },
      {
        type: "function",
        function: {
          name: "scanFile",
          description: "Scan a file from a specified start line to an end line",
          parameters: {
            type: "object",
            properties: {
              filePath: {
                type: "string",
                description: "The path to the file to be scanned",
              },
              startLine: {
                type: "number",
                description: "The line number to start scanning from",
              },
              endLine: {
                type: "number",
                description: "The line number to stop scanning at",
              },
            },
            required: ["filePath", "startLine", "endLine"],
          },
          returns: {
            type: "string",
            description:
              "The contents of the specified range of lines from the file",
          },
        },
      },
      {
        type: "function",
        function: {
          name: "writeFile",
          description: "Write the full contents to a file",
          parameters: {
            type: "object",
            properties: {
              filePath: {
                type: "string",
                description: "The path to the file to be written to",
              },
              content: {
                type: "string",
                description: "The content to write to the file",
              },
            },
            required: ["filePath", "content"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "applyPatchFile",
          description: "Apply a patch file to a file",
          parameters: {
            type: "object",
            properties: {
              filePath: {
                type: "string",
                description: "The path to the file to be patched",
              },
              patch: {
                type: "string",
                description: "The patch to apply",
              },
            },
            required: ["filePath", "patch"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "execCommand",
          description:
            "Execute a command in the system's command line interface",
          parameters: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description: "The command to execute",
              },
            },
            required: ["command"],
          },
          returns: {
            type: "object",
            properties: {
              stdout: {
                type: "string",
                description: "The standard output of the executed command",
              },
              stderr: {
                type: "string",
                description:
                  "The standard error output of the executed command",
              },
            },
            description:
              "The result of the command execution, including any output and errors",
          },
        },
      },
    ] as Array<ChatCompletionTool>;

    const response = await openai.chat.completions.create({
      model,
      messages: messages,
      tools: tools,
      tool_choice: "auto", // auto is default, but we'll be explicit
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
      };

      // extend conversation with assistant's reply
      messages.push(responseMessage);

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionToCall = availableFunctions[functionName];
        const functionArgs = JSON.parse(toolCall.function.arguments);
        const functionResponse = functionToCall(...Object.values(functionArgs));
        const toolMessage = {
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: functionResponse,
        } as ChatCompletionToolMessageParam;

        // Add the tool responses to the thread
        messages.push(toolMessage);
      }

      // Send the tool responses back to the model
      const secondResponse = await openai.chat.completions.create({
        model,
        messages: messages,
      });

      return secondResponse.choices[0].message.content;
    }
  }
}

export const Developer = new CodebaseAgent();

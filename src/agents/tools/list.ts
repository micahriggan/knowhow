import { ChatCompletionTool } from "openai/resources/chat";
import { Plugins } from "../../plugins/plugins";

const pluginNames = Plugins.listPlugins().join(", ");
export const Tools = [
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
      description:
        "Apply a patch file to a file. Use this to modify files without specifying full file contents",
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
      description: "Execute a command in the system's command line interface",
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
            description: "The standard error output of the executed command",
          },
        },
        description:
          "The result of the command execution, including any output and errors",
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finalAnswer",
      description: "Finalize the AI's task and return the answer to the user",
      parameters: {
        type: "object",
        properties: {
          answer: {
            type: "string",
            description:
              "The AI's answer to be displayed to the user as the full explanation of the task and what was done",
          },
        },
        required: ["answer"],
      },
      returns: {
        type: "string",
        description:
          "The final answer string that will be displayed to the user",
      },
    },
  },
  {
    type: "function",
    function: {
      name: "callPlugin",
      description: `Call a specified plugin with given input. Plugins provide additional context from supported URLs or words. Currently available plugins: ${pluginNames}`,
      parameters: {
        type: "object",
        properties: {
          pluginName: {
            type: "string",
            description: "The name of the plugin to be called",
          },
          userInput: {
            type: "string",
            description: "The input to pass to the plugin",
          },
        },
        required: ["pluginName", "userInput"],
      },
      returns: {
        type: "string",
        description: "The result of the plugin call",
      },
    },
  },
] as Array<ChatCompletionTool>;

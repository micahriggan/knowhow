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
              "The code, keyword or phrase to search for via embedding search",
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
      name: "execCommand",
      description:
        "Execute a command in the system's command line interface. Use this to run tests and things in the terminal",
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
      description:
        "Finalize the AI's task and return the answer to the user. You are required to call this at the end to send the response to the user",
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
  {
    type: "function",
    function: {
      name: "visionTool",
      description: "Ask the vision API a question about an image url",
      parameters: {
        type: "object",
        properties: {
          imageUrl: {
            type: "string",
            description: "The url of the image to load",
          },
          question: {
            type: "string",
            description: "The prompt related to the image",
          },
        },
        required: ["imageUrl", "question"],
      },
      returns: {
        type: "string",
        description:
          "The results of the vision API call as an answer to the prompt question",
      },
    },
  },

  {
    type: "function",
    function: {
      name: "readFileAsBlocks",
      description:
        "Read the contents of a file and return them as an array of blocks",
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
        type: "array",
        description:
          "An array of file blocks, where each block contains a portion of the file's content",
      },
    },
  },
  {
    type: "function",
    function: {
      name: "readBlocksFromFile",
      description:
        "Read specific blocks from a file based on block numbers. Blocks are numbered blocks of text, containing a few lines of content",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description:
              "The path to the file from which blocks are to be read",
          },
          blockNumbers: {
            type: "array",
            items: {
              type: "number",
            },
            description: "An array of block numbers to be read from the file",
          },
        },
        required: ["filePath", "blockNumbers"],
      },
      returns: {
        type: "array",
        description:
          "An array of file blocks corresponding to the specified block numbers",
      },
    },
  },
  {
    type: "function",
    function: {
      name: "writeBlocksToFile",
      description:
        "Write an array of file blocks back to the file, updating the specified blocks",
      parameters: {
        type: "object",
        properties: {
          fileBlocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                blockNumber: {
                  type: "number",
                  description:
                    "The block number that identifies the position of the block in the file",
                },
                content: {
                  type: "string",
                  description:
                    "The content to be written in the block. Content may be larger than the block size, new blocks will be created as needed",
                },
              },
              required: ["blockNumber", "content"],
            },
            description: "An array of file blocks to be written to the file",
          },
          filePath: {
            type: "string",
            description: "The path to the file to be written to",
          },
        },
        required: ["fileBlocks", "filePath"],
      },
    },
  },
] as Array<ChatCompletionTool>;

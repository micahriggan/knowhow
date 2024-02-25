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
      name: "readFile",
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
      name: "readBlocks",
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
      name: "modifyFile",
      description:
        "Breaks a file into chunks of X characters. You can modify that block, by completely replacing it with new text. Make modifications step by step by thinking about the blocks that are being replaced. DO NOT EXCLUDE ANY TEXT FROM A BLOCK UNLESS YOU WANT TO DELETE IT. MODIFICATIONS WILL ERASE EXISTING TEXT IF YOU DONT INCLUDE IT IN YOUR UPDATE AS WELL. Only blocks with number as specified in this call will be modified. You can assign empty string to a block to delete all the text in that section. If you assign text to a block, the previous text will be erased. If you need to append blocks, then increase the block number, but ensure you pay close attention to syntax, as the previous block may contain closing characters and you will need to delete that character from the previous block and add it to the new block. Also pay close attention to the existing methods, as you may accidentally replace methods with new methods.",
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
                    "The content in the block will be overwritten with this content. Other blocks will remain unchanged",
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
  {
    type: "function",
    function: {
      name: "applyPatchFile",
      description:
        "Apply a patch file to a file. Use this to modify files without specifying full file contents. This uses the diff npm package. Use this only if you are having trouble with modifyFile",
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
      name: "lintFile",
      description:
        "Lint a file based on the file extension using predefined linting commands from the configuration.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The path to the file to be linted.",
          },
        },
        required: ["filePath"],
      },
      returns: {
        type: "string",
        description:
          "The result of the linting process or an empty string if no lint command is configured for the file extension.",
      },
    },
  },
] as ChatCompletionTool[];

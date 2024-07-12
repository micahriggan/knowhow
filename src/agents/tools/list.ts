import { ChatCompletionTool } from "openai/resources/chat";
import { Plugins } from "../../plugins/plugins";

const pluginNames = Plugins.listPlugins().join(", ");

export const includedTools = [
  {
    type: "function",
    function: {
      name: "embeddingSearch",
      description:
        "Fuzzy search with cosine similarity for files related to the user's goal. Uses embeddings. Use textSearch for exact matches.",
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
      description: `Call a specified plugin with given input. Plugins provide additional context from supported URLs or words. This is a read-only operation. Currently available plugins: ${pluginNames}`,
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
      name: "patchFile",
      description:
        "Modify file with patch. Can also create new files. Use GNU diffutils syntax with - in front of removals and + in front of additions. Always check your work after applying a patch to ensure the patch did what you expected. Think step by step while constructing the patch, of which lines your will add and remove. Make sure that your patch is maintaining proper syntax. Do not modify lines unrelated to the goal. Patches should contain 3 to 6 lines of context before and after changes. No omissions of lines for removals are allowed.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The path to the file to be patched",
          },
          patch: {
            type: "string",
            description: "The patch to apply in unified diff format",
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
  {
    type: "function",
    function: {
      name: "textSearch",
      description:
        "Exact Search. Search for exact matches of text across files. Use embeddingSearch for fuzzy search.",
      parameters: {
        type: "object",
        properties: {
          searchTerm: {
            type: "string",
            description: "The text string to search for across files",
          },
        },
        required: ["searchTerm"],
      },
      returns: {
        type: "string",
        description: "The result of the text search, including any matches",
      },
    },
  },
  {
    type: "function",
    function: {
      name: "askHuman",
      description: "Ask a human a question and get a response.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The question to ask the human. Can be in markdown",
          },
        },
        required: ["question"],
      },
      returns: {
        type: "string",
        description: "The response from the human.",
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createTask",
      description: "Create a new task in Asana",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "The ID of the project where the task will be created",
          },
          taskName: {
            type: "string",
            description: "The name of the task to be created",
          },
          taskNotes: {
            type: "string",
            description: "The notes or description of the task",
          },
        },
        required: ["projectId", "taskName", "taskNotes"],
      },
      returns: {
        type: "object",
        description: "The created task object",
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateTask",
      description: "Update an existing task in Asana",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "The ID of the task to be updated",
          },
          updates: {
            type: "object",
            description:
              "An object containing the updates to be applied to the task",
          },
        },
        required: ["taskId", "updates"],
      },
      returns: {
        type: "object",
        description: "The updated task object",
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchTasks",
      description: "Search for tasks in Asana based on a search term",
      parameters: {
        type: "object",
        properties: {
          searchTerm: {
            type: "string",
            description: "The term to search for in task names and notes",
          },
        },
        required: ["searchTerm"],
      },
      returns: {
        type: "array",
        description: "An array of tasks that match the search term",
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listProjects",
      description: "List all projects in Asana",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      returns: {
        type: "array",
        description: "An array of project objects",
      },
    },
  },

  {
    type: "function",
    function: {
      name: "findTask",
      description: "Find a specific task in Asana by its ID",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "The ID of the task to be found",
          },
        },
        required: ["taskId"],
      },
      returns: {
        type: "object",
        description: "The task object that matches the given ID",
      },
    },
  },
  {
    type: "function",
    function: {
      name: "myTasks",
      description:
        "Retrieve tasks assigned to the current user in Asana, only shows the uncompleted ones",
      parameters: {
        type: "object",
        properties: {
          project: {
            type: "string",
            description: "The ID of the project to filter tasks by (optional)",
          },
        },
        required: [],
      },
      returns: {
        type: "array",
        description: "An array of tasks assigned to the current user",
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getSubtasks",
      description: "Retrieve all subtasks for a given Asana task.",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description:
              "The ID of the parent task for which to retrieve subtasks.",
          },
        },
        required: ["taskId"],
      },
      returns: {
        type: "array",
        description:
          "An array of subtasks associated with the specified parent task.",
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createSubtask",
      description: "Create a new subtask under a given Asana task.",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description:
              "The ID of the parent task under which the subtask will be created.",
          },
          taskName: {
            type: "string",
            description: "The name of the subtask to be created.",
          },
          taskNotes: {
            type: "string",
            description: "The optional notes or description of the subtask.",
          },
        },
        required: ["taskId", "taskName"],
      },
      returns: {
        type: "object",
        description: "The created subtask object.",
      },
    },
  },
] as ChatCompletionTool[];

export const definitions = [
  {
    type: "function",
    function: {
      name: "sendVimInput",
      description:
        "Open a vim instance and send text to it. You can send many commands as one string. Each element in the keys array will add a delay, so add new elements if you expect some amount of time to be required between commands. You can use this command to open new files, change to insert mode, escape with '<ESCAPE>', save with ':w', and quit with ':q'. You will receive back an array of how the terminal changed after your input.",
      parameters: {
        type: "object",
        properties: {
          inputs: {
            type: "array",
            description: "An array of vim commands / inputs to send to Vim.",
            items: {
              type: "string",
            },
          },
          delay: {
            type: "number",
            description:
              "Optional delay between sending each input command, defaulting to 3 seconds. You can use shorter delays once the file is open",
          },
        },
        required: ["inputs"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "closeVim",
      description:
        "Closes the Vim process. Must be used before calling finalAnswer",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "openFileInVim",
      description:
        "Use this to open a file in vim. Ensures the file is opened correctly, so you don't have to use sendVimInput",
      parameters: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "The filepath to the file to be opened",
          },
        },
        required: ["filepath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "saveVimFile",
      description: "Saves the active file in vim",
      parameters: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "The filepath to the file to be saved",
          },
        },
        required: ["filepath"],
      },
    },
  },
];

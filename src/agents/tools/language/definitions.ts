import { Plugins } from "../../../plugins/plugins";
export const definitions = [
  {
    type: "function",
    function: {
      name: "addLanguageTerm",
      description:
        "Add a new language term to the language config, which can help load context for given terms in the future.",
      parameters: {
        type: "object",
        properties: {
          term: {
            type: "string",
            description:
              "The trigger word(s) that should load the given context",
          },
          sources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: {
                  type: "string",
                  description: `The type of datasource, options are "file", "url", "text" or the name of a plugin: ${Plugins.listPlugins()}
                  For files you must use the full relative path. For plugins you must use the name of the plugin associated with the data.
                  Always use a plugin as the kind, if a plugin name is in the url.
                  `,
                },
                data: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description:
                    "An array of strings that will be loaded when a language term is used in a user prompt. If the kind was a plugin, then we'll call the plugin with each string as input. Strings of the same kind should be grouped together in one array of data.",
                },
              },
              required: ["kind", "data"],
            },
            description: "The sources to be loaded for the given term",
          },
        },
        required: ["term"],
      },
      returns: {
        type: "string",
        description: "The response from the human.",
      },
    },
  },
];
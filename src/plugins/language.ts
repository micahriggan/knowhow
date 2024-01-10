import { readFile, fileExists, fileStat } from "../utils";
import { Language } from "../types";
import { getConfig, getLanguageConfig } from "../config";
import { Plugin } from "./types";
import { GitHubPlugin } from "./github";
import { AsanaPlugin } from "./asana";
import { JiraPlugin } from "./jira";
import { LinearPlugin } from "./linear";
import { Plugins } from "./plugins";

export class LanguagePlugin implements Plugin {
  constructor() {}

  async embed(userPrompt: string) {
    return [];
  }

  async call(userPrompt: string): Promise<string> {
    const config = await getConfig();
    const languageConfig = await getLanguageConfig();
    // Extract terms from the language configuration
    const terms = Object.keys(languageConfig);

    // Find all matching terms in the userPrompt
    const matchingTerms = terms.filter((term) => userPrompt.includes(term));
    if (matchingTerms.length > 0) {
      console.log("LANGUAGE PLUGIN: Found matching terms", matchingTerms);
    }

    const sources = matchingTerms.flatMap(
      (term) => languageConfig[term].sources
    );

    const contexts = [];

    // Load the files for the matching terms
    const filesToLoad = sources
      .filter((f) => f.kind === "file")
      .map((f) => f.data)
      .flat();

    // Read the contents of the files
    const fileContents = await Promise.all(
      filesToLoad.map(async (filePath) => {
        const exists = await fileExists(filePath);
        if (!exists) {
          return { filePath, content: `File ${filePath} does not exist` };
        }
        let content = (await readFile(filePath, "utf8")).toString();
        return { filePath, content };
      })
    );
    contexts.push(...fileContents);

    const textContexts = matchingTerms
      .flatMap((term) =>
        languageConfig[term].sources.filter((s) => s.kind === "text")
      )
      .map((s) => s.data);
    contexts.push(...textContexts);

    const plugins = Plugins.listPlugins();
    for (const plugin of plugins) {
      if (config.plugins.includes(plugin)) {
        const matchingSources = sources.filter((s) => s.kind === plugin);
        if (matchingSources.length === 0) {
          continue;
        }

        const data = matchingSources
          .map((s) => s.data)
          .flat()
          .join("\n");
        console.log("LANGUAGE PLUGIN: Calling plugin", plugin, data);
        const pluginContext = await Plugins.call(plugin, data);

        contexts.push(...pluginContext);
      }
    }

    if (!matchingTerms || !matchingTerms.length) {
      return "LANGUAGE PLUGIN: No matching terms found";
    }

    // Return the file contents in a format that can be added to the prompt context
    return `LANGUAGE PLUGIN: The following terms triggered expansions ${matchingTerms} expanded to: ${JSON.stringify(
      contexts
    )}`;
  }
}

// Since this uses other plugins, it needs to be registered
Plugins.registerPlugin("language", new LanguagePlugin());

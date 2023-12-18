import { readFile, fileExists, fileStat } from "../utils";
import { Language } from "../types";
import { getConfig, getLanguageConfig } from "../config";
import { Plugin } from "./types";
import { GitHubPlugin } from "./github";
import { AsanaPlugin } from "./asana";
import { JiraPlugin } from "./jira";
import { LinearPlugin } from "./linear";

export class LanguagePlugin implements Plugin {
  constructor() {}

  async call(userPrompt: string): Promise<string> {
    const config = await getConfig();
    const languageConfig = await getLanguageConfig();
    // Extract terms from the language configuration
    const terms = Object.keys(languageConfig);

    // Find all matching terms in the userPrompt
    const matchingTerms = terms.filter((term) => userPrompt.includes(term));

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
          throw new Error(`File ${filePath} does not exist`);
        }
        let content = await readFile(filePath, "utf8").toString();
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

    if (config.plugins.includes("github")) {
      const githubPlugin = new GitHubPlugin();
      const githubUrls = sources
        .filter((s) => s.kind === "github")
        .map((s) => s.data)
        .flat()
        .join("\n");

      const urls = githubPlugin.extractUrls(githubUrls);
      const diffs = urls ? await githubPlugin.getParsedDiffs(urls) : [];
      contexts.push(...diffs);
    }

    if (config.plugins.includes("asana")) {
      const asanaPlugin = new AsanaPlugin();
      const asanaUrls = sources
        .filter((s) => s.kind === "asana")
        .map((s) => s.data)
        .flat()
        .join("\n");

      const urls = asanaPlugin.extractUrls(asanaUrls);
      const tasks = urls ? await asanaPlugin.getTasksFromUrls(urls) : [];
      contexts.push(...tasks);
    }

    if (config.plugins.includes("jira")) {
      const jiraPlugin = new JiraPlugin();
      const jiraUrls = sources
        .filter((s) => s.kind === "jira")
        .map((s) => s.data)
        .flat()
        .join("\n");

      const urls = jiraPlugin.extractUrls(jiraUrls);
      const tasks = urls ? await jiraPlugin.getTasksFromUrls(urls) : [];
      contexts.push(...tasks);
    }

    if (config.plugins.includes("linear")) {
      const linearPlugin = new LinearPlugin();
      const linearUrls = sources
        .filter((s) => s.kind === "linear")
        .map((s) => s.data)
        .flat()
        .join("\n");

      const urls = linearPlugin.extractUrls(linearUrls);
      const tasks = urls ? await linearPlugin.getTasksFromUrls(urls) : [];
      contexts.push(...tasks);
    }

    if (!matchingTerms) {
      return "LANGUAGE PLUGIN: No matching terms found";
    }

    // Return the file contents in a format that can be added to the prompt context
    return `LANGUAGE PLUGIN: The following terms triggered expansions ${matchingTerms} expanded to: ${JSON.stringify(
      contexts
    )}`;
  }
}

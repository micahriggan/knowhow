import { readFile, fileExists, fileStat } from "../utils";
import { Language } from "../types";
import { getConfig, getLanguageConfig } from "../config";
import { Plugin } from "./types";

export class LanguagePlugin implements Plugin {
  constructor() {}

  async call(userPrompt: string): Promise<string> {
    const languageConfig = await getLanguageConfig();
    // Extract terms from the language configuration
    const terms = Object.keys(languageConfig);

    // Find all matching terms in the userPrompt
    const matchingTerms = terms.filter((term) => userPrompt.includes(term));

    // Load the files for the matching terms
    const filesToLoad = matchingTerms
      .flatMap((term) => languageConfig[term].sources)
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

    const textContexts = matchingTerms
      .flatMap((term) =>
        languageConfig[term].sources.filter((s) => s.kind === "text")
      )
      .map((s) => s.data);

    // Return the file contents in a format that can be added to the prompt context
    return `LANGUAGE PLUGIN: The following terms triggered expansions ${matchingTerms} expanded to: ${JSON.stringify(
      fileContents
    )}, ${JSON.stringify(textContexts)}`;
  }
}

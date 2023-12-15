import glob from "glob";
import { readFile, fileExists, fileStat } from "./utils";
import { Language } from "./types";
import { getConfig, getLanguageConfig } from "./config";

interface Plugin {
  call(user_input?: string): Promise<string>;
}

class PluginService {
  plugins = {
    vim: new VimPlugin(),
    language: new LanguagePlugin(),
  } as Record<string, Plugin>;

  registerPlugin(name, plugin: Plugin) {
    this.plugins[name] = plugin;
  }

  async callMany(plugins: string[], user_input?: string) {
    const calls = plugins.map((p) => this.plugins[p].call(user_input));
    return (await Promise.all(calls)).join("\n");
  }
}

class VimPlugin implements Plugin {
  async getVimFiles() {
    const vimFiles = await glob.sync("./**/*.swp", { dot: true });
    return vimFiles;
  }

  async getSourcePath(vimPath: string) {
    const pathParts = vimPath.split("/");
    const fileName = pathParts[pathParts.length - 1];
    const cleanedFileName = fileName.slice(1, fileName.length - 4);
    const sourcePath = pathParts.slice(0, pathParts.length - 1).join("/");
    return sourcePath + "/" + cleanedFileName;
  }

  async getFileContents(swapFile: string) {
    const filePath = await this.getSourcePath(swapFile);
    const exists = await fileExists(filePath);
    if (!exists) {
      throw new Error(`File ${filePath} does not exist`);
    }

    const stat = await fileStat(filePath);
    if (stat.isDirectory()) {
      return { filePath, content: "DIRECTORY" };
    }
    if (stat.size > 32000) {
      console.error(`File ${filePath} is too large with size ${stat.size}`);
      return { filePath, content: "FILE TOO LARGE" };
    }

    console.log(`Reading file ${filePath}`);
    const content = await readFile(filePath, "utf8");
    return { filePath, content };
  }

  async call() {
    const vimFiles = await this.getVimFiles();
    const fileContents = await Promise.all(
      vimFiles.map((f) => this.getFileContents(f))
    );
    return (
      "VIM PLUGIN: The following files are open in vim: " +
      JSON.stringify(fileContents)
    );
  }
}

class LanguagePlugin implements Plugin {
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

export const Plugins = new PluginService();

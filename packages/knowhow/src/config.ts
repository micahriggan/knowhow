import * as fs from "fs";
import * as path from "path";
import gitignoreToGlob from "gitignore-to-glob";
import { Prompts } from "./prompts";
import { promisify } from "util";
import { Config, Language, AssistantConfig } from "./types";
import { mkdir, writeFile, readFile, fileExists } from "./utils";

export async function init() {
  // create the folder structure
  await mkdir(".knowhow", { recursive: true });
  await mkdir(".knowhow/prompts", { recursive: true });
  await mkdir(".knowhow/docs", { recursive: true });
  await mkdir(".knowhow/embeddings", { recursive: true });

  // Copy the template prompts
  await copyTemplates();

  // create knowhow.json
  const config = {
    promptsDir: ".knowhow/prompts",
    modules: [],
    plugins: [
      "embeddings",
      "language",
      "vim",
      "github",
      "asana",
      "jira",
      "linear",
      "download",
      "figma",
    ],
    lintCommands: {
      js: "eslint",
      ts: "tslint",
    },
    sources: [
      {
        input: "src/**/*.mdx",
        output: ".knowhow/docs/",
        prompt: "BasicCodeDocumenter",
      },
      {
        input: ".knowhow/docs/**/*.mdx",
        output: ".knowhow/docs/README.mdx",
        prompt: "BasicProjectDocumenter",
      },
    ],
    embedSources: [
      {
        input: ".knowhow/docs/**/*.mdx",
        output: ".knowhow/embeddings/docs.json",
        prompt: "BasicEmbeddingExplainer",
        chunkSize: 500,
      },
    ],
    agents: [
      {
        name: "Example agent",
        description:
          "You can define agents in the config. They will have access to all tools.",
        instructions: "Reply to the user saying 'Hello, world!'",
        model: "gpt-4o-2024-08-06",
        provider: "openai",
      },
    ],
    mcps: [
      {
        name: "browser",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-puppeteer"],
      },
    ],

    modelProviders: [{ url: "http://localhost:1234", provider: "lms" }],
  } as Config;
  await updateConfig(config);

  const assistants = {
    files: {},
  } as AssistantConfig;

  const language = {
    "knowhow config": {
      sources: [
        {
          kind: "file",
          data: [".knowhow/knowhow.json"],
        },
      ],
    },
  } as Language;

  await writeFile(".knowhow/language.json", JSON.stringify(language, null, 2));
  await writeFile(".knowhow/.hashes.json", "{}");
  await writeFile(".knowhow/.ignore", "");
}

export async function getLanguageConfig() {
  const language = JSON.parse(await readFile(".knowhow/language.json", "utf8"));
  return language as Language;
}

export async function updateLanguageConfig(language: Language) {
  await writeFile(".knowhow/language.json", JSON.stringify(language, null, 2));
}

export async function updateConfig(config: Config) {
  await writeFile(".knowhow/knowhow.json", JSON.stringify(config, null, 2));
}

async function copyTemplates() {
  for (const prompt of Prompts) {
    const promptName = Object.keys(prompt)[0];
    const promptPath = path.join(".knowhow/prompts", promptName + ".mdx");
    await writeFile(promptPath, prompt[promptName]);
  }
}

export function getConfigSync() {
  try {
    const config = JSON.parse(
      fs.readFileSync(".knowhow/knowhow.json", "utf8").toString()
    );
    return config as Config;
  } catch (e) {
    return {} as Config;
  }
}

export async function getConfig() {
  const config = JSON.parse(await readFile(".knowhow/knowhow.json", "utf8"));
  return config as Config;
}

export async function loadPrompt(promptName: string) {
  const config = await getConfig();
  if (!promptName) {
    return "";
  }

  const prompt = await readFile(
    path.join(config.promptsDir, `${promptName}.mdx`),
    "utf8"
  );
  return prompt;
}

export async function getIgnorePattern() {
  const ignoreList = new Array<string>();
  const gitIgnore = await fileExists(".gitignore");
  if (gitIgnore) {
    ignoreList.push(...gitignoreToGlob(".gitignore"));
  }
  const knowhowIgnore = await fileExists(".knowhow/.ignore");
  if (knowhowIgnore) {
    ignoreList.push(...gitignoreToGlob(".knowhow/.ignore"));
  }
  return ignoreList.map((pattern) => pattern.replace("!", "./"));
}

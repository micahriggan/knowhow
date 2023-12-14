import * as path from "path";
import { Prompts } from "./prompts";
import { promisify } from "util";
import { Config, Language, AssistantConfig } from "./types";
import { mkdir, writeFile, readFile } from "./utils";

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
    plugins: ["language", "vim"],
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
        output: ".knowhow/embeddings",
        prompt: "BasicEmbeddingExplainer",
      },
    ],
    assistants: [
      {
        name: "Codebase Helper",
        description: "Helps you code",
        instructions: "Codebase helper, use files and tools to help us code",
        model: "gpt-4-1106-preview",
        tools: [{ type: "code_interpreter" }],
        files: [".knowhow/docs/**/*.mdx"],
      },
    ],
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
  await updateAssistants(assistants);
}

export async function getAssistantsConfig() {
  const assistants = JSON.parse(
    await readFile(".knowhow/.assistants.json", "utf8")
  );
  return assistants as AssistantConfig;
}

export async function updateAssistants(assistants: AssistantConfig) {
  await writeFile(
    ".knowhow/.assistants.json",
    JSON.stringify(assistants, null, 2)
  );
}

export async function getLanguageConfig() {
  const language = JSON.parse(await readFile(".knowhow/language.json", "utf8"));
  return language as Language;
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

export async function getConfig() {
  const config = JSON.parse(await readFile(".knowhow/knowhow.json", "utf8"));
  return config as Config;
}

export async function loadPrompt(promptName: string) {
  const config = await getConfig();
  const prompt = await readFile(
    path.join(config.promptsDir, `${promptName}.mdx`),
    "utf8"
  );
  return prompt;
}

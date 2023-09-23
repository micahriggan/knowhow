import * as path from "path";
import { Prompts } from "./prompts";
import { promisify } from "util";
import { Config } from "./types";
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
  } as Config;
  await writeFile(".knowhow/knowhow.json", JSON.stringify(config, null, 2));
  await writeFile(".knowhow/.hashes.json", "{}");
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

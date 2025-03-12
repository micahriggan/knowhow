import * as fs from "fs";
import { loadSummarizationChain } from "langchain/chains";
import { PromptTemplate } from "langchain/prompts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { readFile } from "./utils";

import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChatOpenAI } from "langchain/chat_models/openai";
import OpenAI from "openai";
import { Assistant } from "./types";
import { convertToText } from "./conversion";
import { getConfigSync } from "./config";
import { Clients } from "./clients";

const config = getConfigSync();
const OPENAI_KEY = process.env.OPENAI_KEY;

import { Models } from "./types";
export { Models };

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
  ...(config.openaiBaseUrl && { baseURL: config.openaiBaseUrl }),
});

export async function singlePrompt(
  userPrompt: string,
  model = Models.openai.GPT_4o,
  provider = "openai"
) {
  const resp = await Clients.createCompletion(provider, {
    model,
    messages: [{ role: "user", content: userPrompt }],
  });

  return resp?.choices?.[0]?.message?.content;
}

export async function getChatClient(model = Models.openai.GPT_4o) {
  return new ChatOpenAI({
    temperature: 0,
    openAIApiKey: OPENAI_KEY,
    modelName: model,
    maxRetries: 2,
  });
}

export async function summarizeTexts(
  texts: string[],
  template: string,
  model = Models.openai.GPT_4o,
  provider = "openai"
) {
  const summaries = [];
  for (const text of texts) {
    const content = template.replaceAll("{text}", text);

    console.log(content);

    const summary = await singlePrompt(content, model, provider);
    summaries.push(summary);
  }

  if (summaries.length === 1) {
    return summaries[0];
  }

  // Otherwise form a final summary of the pieces

  const finalPrompt =
    `Generate a final output for this prompt ${template} with these incremental summaries: ` +
    summaries.join("\n\n");

  const finalSummary = await singlePrompt(finalPrompt, model, provider);
  return finalSummary;
}

export async function chunkText(text: string, chunkSize?: number) {
  chunkSize = chunkSize || text.length;

  const docs = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    docs.push(text.slice(i, i + chunkSize));
  }

  return docs;
}

export async function summarizeFiles(
  files: string[],
  template: string,
  model = Models.openai.GPT_4o
) {
  const texts = [];
  for (const file of files) {
    const text = `file: ${file}\n` + (await convertToText(file));
    texts.push(text);
  }
  return summarizeTexts(texts, template, model);
}

export async function summarizeFile(
  file: string,
  template: string,
  model = Models.openai.GPT_4o
) {
  return await summarizeFiles([file], template, model);
}

export async function uploadToOpenAi(filePath: string) {
  // Upload a file with an "assistants" purpose
  const file = await openai.files.create({
    file: fs.createReadStream(filePath),
    purpose: "assistants",
  });

  console.log(`File uploaded successfully. ID: ${file.id}`);
  return file;
}

export async function createAssistant(assistant: Assistant) {
  const { name, tools, description, instructions, model } = assistant;
  console.log("Creating assistant is currently broken", assistant);
  return;
  const created = await openai.beta.assistants.create({
    name,
    tools,
    description,
    file_ids: assistant.files,
    instructions,
    model,
  });
  console.log(`Assistant created successfully. ID: ${created.id}`);
  return created;
}

export async function askGptVision(imageUrl: string, question: string) {
  const response = await openai.chat.completions.create({
    model: Models.openai.GPT_4o,
    max_tokens: 2500,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: question },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
  });

  return response.choices[0].message.content;
}

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

const config = getConfigSync();
const OPENAI_KEY = process.env.OPENAI_KEY;
const chatModel = new ChatOpenAI({
  temperature: 0,
  openAIApiKey: OPENAI_KEY,
  modelName: "gpt-4-1106-preview",
  maxRetries: 2,
});

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
  ...(config.openaiBaseUrl && { baseURL: config.openaiBaseUrl }),
});

export async function summarizeTexts(texts: string[], template: string) {
  const prompt = new PromptTemplate({
    template,
    inputVariables: ["text"],
  });

  const summarizationChain = await loadSummarizationChain(chatModel, {
    prompt,
    type: "stuff",
  });

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 20000,
  });

  const docs = await textSplitter.createDocuments(texts);

  const result = await summarizationChain.call({
    input_documents: docs,
  });

  console.log("Summary", result.text);

  return result.text as string;
}

export async function chunkText(text: string, chunkSize?: number) {
  chunkSize = chunkSize || text.length;
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: chunkSize,
  });

  const docs = await textSplitter.createDocuments([text]);

  return docs.map((d) => d.pageContent);
}

export async function summarizeFiles(files: string[], template: string) {
  const texts = [];
  for (const file of files) {
    const text = await convertToText(file);
    texts.push(text);
  }
  return summarizeTexts(texts, template);
}

export async function summarizeFile(file: string, template: string) {
  return await summarizeFiles([file], template);
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
  console.log("Creating assistant", assistant);
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
    model: "gpt-4-vision-preview",
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

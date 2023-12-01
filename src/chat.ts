import { openai } from "./ai";
import { cosineSimilarity } from "./utils";
import { EmbeddingBase, GptQuestionEmbedding } from "./types";
import { Marked } from "./utils";
import { ask } from "./utils";

export async function queryEmbedding<E extends EmbeddingBase>(
  query: string,
  embeddings: Array<E>
) {
  const queryEmbedding = await openai.embeddings.create({
    input: query,
    model: "text-embedding-ada-002",
  });
  const queryVector = queryEmbedding.data[0].embedding;
  const results = new Array<E>();
  for (const embedding of embeddings) {
    const similarity = cosineSimilarity(embedding.vector, queryVector);
    results.push({
      ...embedding,
      similarity,
    });
  }
  return results.sort((a, b) => b.similarity - a.similarity);
}

export async function askEmbedding<E>(
  embeddings: Array<E>,
  promptText: string,
  handleAnswer: (question: string, answer: E) => void
) {
  console.log("Commands: next, exit");
  let input = await ask(promptText + ": ");
  let answer: E | undefined;
  let results = new Array<E>();
  while (input !== "exit") {
    switch (input) {
      case "next":
        answer = results.shift();
        break;
      default:
        results = await queryEmbedding(input, embeddings);
        answer = results.shift();
        break;
    }
    if (answer) {
      handleAnswer(input, answer);
    }

    input = await ask(promptText + ": ");
  }
}

// https://arxiv.org/abs/2212.10496
export async function queryEmbeddingHyde<E extends EmbeddingBase>(
  query: string,
  embeddings: Array<E>
) {
  const generatePrompt = `
Given this question

  ${query}

Generate an article or document that answers the question.
`;

  const response = await openai.completions.create({
    prompt: generatePrompt,
    model: "text-davinci-003",
    max_tokens: 100,
    temperature: 0,
    top_p: 1,
    presence_penalty: 0,
    frequency_penalty: 0,
    best_of: 1,
    n: 1,
    stream: false,
  });
  const fakeDoc = response.choices[0].text;
  return queryEmbedding(fakeDoc, embeddings);
}

export async function queryGPT3<E extends EmbeddingBase>(
  query: string,
  embeddings: Array<E>
) {
  const results = await queryEmbeddingHyde(query, embeddings);
  console.log("Synthesizing answer ...");
  const context = results
    .map((r) => ({ ...r, vector: undefined }))
    .map((r) => JSON.stringify(r))
    .map((r) => r.slice(0, 3000))
    .slice(0, 10)
    .join("\n")
    .slice(0, 7500);
  const gptPrompt = `

AngelList knowledge base Assistant

Using the below context, answer this question, include code samples if helpful:

  ${query}

The following are the top most similar entries from our knowledge base:

  ${context}

  Output Format in Markdown

`;
  const gptResponse = await openai.completions.create({
    prompt: gptPrompt,
    model: "text-davinci-003",
    max_tokens: 1000,
    temperature: 0,
    top_p: 1,
    presence_penalty: 0,
    frequency_penalty: 0,
    best_of: 1,
    n: 1,
    stream: false,
  });

  return gptResponse.choices[0].text;
}

export async function askGpt<E extends GptQuestionEmbedding>(
  aiName: string,
  embeddings: Array<E>
) {
  console.log("Commands: next, exit");
  let input = await ask(`Ask ${aiName} AI?: `);
  let answer: E | undefined;
  let results = "";
  while (input !== "exit") {
    results = await queryGPT3(input, embeddings);
    console.log("\n\n");
    console.log(Marked.parse(results));
    console.log("\n\n");
    input = await ask(`Ask ${aiName} AI?: `);
  }
}

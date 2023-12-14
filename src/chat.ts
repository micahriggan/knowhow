import { openai } from "./ai";
import { cosineSimilarity } from "./utils";
import { EmbeddingBase, GptQuestionEmbedding, Embeddable } from "./types";
import { Marked } from "./utils";
import { ask } from "./utils";
import { ChatCompletionMessageParam } from "openai/resources/chat";
import { Plugins } from "./plugins";

export async function queryEmbedding<E>(
  query: string,
  embeddings: Array<Embeddable<E>>
) {
  const queryEmbedding = await openai.embeddings.create({
    input: query,
    model: "text-embedding-ada-002",
  });
  const queryVector = queryEmbedding.data[0].embedding;
  const results = new Array<EmbeddingBase<E>>();
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
  embeddings: Array<Embeddable<E>>,
  promptText: string,
  handleAnswer?: (question: string, answer: EmbeddingBase<any>) => void
) {
  console.log("Commands: next, exit");
  let input = await ask(promptText + ": ");
  let answer: EmbeddingBase<any> | undefined;
  let results = new Array<EmbeddingBase>();
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
    if (answer && handleAnswer) {
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

export async function queryGpt4<E extends EmbeddingBase>(
  query: string,
  embeddings: Array<E>,
  count = 10
) {
  const results = await queryEmbedding(query, embeddings);
  console.log("Synthesizing answer ...");
  const context = results
    .map((r) => ({ ...r, vector: undefined }))
    .slice(0, count);
  const gptPrompt = `

The user has asked:
  ${query}

Our knowledgebase contains this information which can be used to answer the question:

  ${JSON.stringify(context, null, 2)}

  Output Format in Markdown
`;
  console.log(gptPrompt);

  const thread = [
    {
      role: "system",
      content:
        "Helpful Codebase assistant. Answer users questions using the embedding data that is provided with the user's question. You have limited access to the codebase based off of how similar the codebase is to the user's question. You may reference file paths by using the IDs present in the embedding data, but be sure to remove the chunk from the end of the filepaths.",
    },
    { role: "user", content: gptPrompt },
  ] as Array<ChatCompletionMessageParam>;

  const response = await openai.chat.completions.create({
    messages: thread,
    max_tokens: 2500,
    model: "gpt-4-1106-preview",
    temperature: 0,
    top_p: 1,
    presence_penalty: 0,
    frequency_penalty: 0,
  });

  return response.choices[0].message.content;
}

export async function askGpt<E extends GptQuestionEmbedding>(
  aiName: string,
  embeddings: Array<Embeddable<E>>,
  plugins: Array<string> = []
) {
  console.log("Commands: search, exit");
  let input = await ask(`Ask ${aiName} AI?: `);
  let answer: E | undefined;
  let results = "";
  while (input !== "exit") {
    if (input == "search") {
      await askEmbedding(embeddings, "searching", (question, answer) => {
        console.log(JSON.stringify(answer.metadata, null, 2));
      });
    } else {
      const pluginText = await Plugins.callMany(plugins);
      const fullPrompt = `${input} \n ${pluginText}`;
      results = await queryGpt4(fullPrompt, embeddings, 7);
      console.log("\n\n");
      console.log(Marked.parse(results));
    }
    input = await ask(`Ask ${aiName} AI?: `);
  }
}

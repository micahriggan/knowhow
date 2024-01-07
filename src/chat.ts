import { ChatCompletionMessageParam } from "openai/resources/chat";
import Ora from "ora";
import editor from "@inquirer/editor";
import { openai } from "./ai";
import { cosineSimilarity } from "./utils";
import { EmbeddingBase, GptQuestionEmbedding, Embeddable } from "./types";
import { Marked } from "./utils";
import { ask } from "./utils";
import { Plugins } from "./plugins/plugins";
import { queryEmbedding } from "./embeddings";
import { Developer } from "./agents/codebase/codebase";

let DEBUGGER = false;

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

export async function queryGpt4<E extends EmbeddingBase>(query: string) {
  const gptPrompt = `

The user has asked:
  ${query}

  Output Format in Markdown
`;
  if (DEBUGGER) {
    console.log(gptPrompt);
  }

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
  let agent = false;
  let multiLine = false;

  console.log("Commands: search, exit");
  const getInput = (question: string) => {
    return multiLine ? editor({ message: question }) : ask(question);
  };

  let input = await getInput(`Ask ${aiName} AI?: `);
  let answer: E | undefined;
  let results = "";
  while (input !== "exit") {
    try {
      switch (input) {
        case "debugger":
          DEBUGGER = !DEBUGGER;
          break;
        case "multi":
          multiLine = !multiLine;
          break;
        case "search":
          await askEmbedding(embeddings, "searching", (question, answer) => {
            console.log(JSON.stringify(answer.metadata, null, 2));
          });
          break;
        case "clear":
          Developer.clear();
          break;
        case "agent":
          agent = !agent;
          break;
        default:
          console.log("Thinking...");
          const pluginText = await Plugins.callMany(plugins, input);
          const fullPrompt = `${input} \n ${pluginText}`;
          if (agent) {
            results = await Developer.call(fullPrompt);
          } else {
            results = await queryGpt4(fullPrompt);
          }
          console.log("\n\n");
          console.log(Marked.parse(results));
          break;
      }
    } catch (e) {
      console.log(e);
    } finally {
      input = await getInput(`Ask ${aiName} AI?: `);
    }
  }
}

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
import { agentService } from "./services/AgentService";
import { FlagsService } from "./services/flags";
import { IAgent } from "./agents/base/base";
import { Researcher } from "./agents/researcher/researcher";
import { Developer } from "./agents/codebase/codebase";

enum ChatFlags {
  agent = "agent",
  agents = "agents",
  debug = "debug",
  multi = "multi",
}

const Flags = new FlagsService(
  [ChatFlags.agent, ChatFlags.debug, ChatFlags.multi],
  true
);

export async function askEmbedding<E>(
  embeddings: Embeddable<E>[],
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
  embeddings: E[]
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
  if (Flags.enabled("debugger")) {
    console.log(gptPrompt);
  }

  const thread = [
    {
      role: "system",
      content:
        "Helpful Codebase assistant. Answer users questions using the embedding data that is provided with the user's question. You have limited access to the codebase based off of how similar the codebase is to the user's question. You may reference file paths by using the IDs present in the embedding data, but be sure to remove the chunk from the end of the filepaths.",
    },
    { role: "user", content: gptPrompt },
  ] as ChatCompletionMessageParam[];

  const response = await openai.chat.completions.create({
    messages: thread,
    max_tokens: 2500,
    model: "gpt-4o",
    temperature: 0,
    top_p: 1,
    presence_penalty: 0,
    frequency_penalty: 0,
  });

  return response.choices[0].message.content;
}

export async function getInput(
  question: string,
  multiLine = false,
  options = []
): Promise<string> {
  const value: string = await (multiLine
    ? editor({ message: question })
    : ask(question, options));

  return value.trim();
}

export async function askGpt<E extends GptQuestionEmbedding>(
  aiName: string,
  embeddings: Embeddable<E>[],
  plugins: string[] = []
) {
  console.log("Commands: search, exit");

  let activeAgent: IAgent = Developer;
  const commands = ["agent", "agents", "debugger", "exit", "multi", "search"];
  const promptText = () =>
    Flags.enabled(ChatFlags.agent)
      ? `\nAsk ${aiName} ${activeAgent.name}: `
      : `\nAsk ${aiName}: `;

  let input = await getInput(
    promptText(),
    Flags.enabled(ChatFlags.multi),
    commands
  );

  let results = "";
  while (input !== "exit") {
    try {
      switch (input) {
        case ChatFlags.agents:
          Flags.enable(ChatFlags.agent);
          const agents = agentService.listAgents();
          console.log(agents);
          const selected = await ask(
            "Which agent would you like to use: ",
            agents
          );
          activeAgent = agentService.getAgent(selected);
          break;
        case ChatFlags.agent:
          Flags.flip(ChatFlags.agent);
          break;
        case ChatFlags.debug:
          Flags.flip(ChatFlags.debug);
          break;
        case ChatFlags.multi:
          Flags.flip(ChatFlags.multi);
          break;
        case "search":
          await askEmbedding(embeddings, "searching", (question, _answer) => {
            console.log(JSON.stringify(_answer.metadata, null, 2));
          });
          break;
        case "":
          break;
        default:
          console.log("Thinking...");
          console.log(input);
          const pluginText = await Plugins.callMany(plugins, input);
          const fullPrompt = `${input} \n ${pluginText}`;
          if (Flags.enabled("agent")) {
            results = await activeAgent.call(fullPrompt);
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
      input = await getInput(
        promptText(),
        Flags.enabled(ChatFlags.multi),
        commands
      );
    }
  }
}

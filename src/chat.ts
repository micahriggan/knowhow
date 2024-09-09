import { ChatCompletionMessageParam } from "openai/resources/chat";
import Ora from "ora";
import editor from "@inquirer/editor";
import { openai } from "./ai";
import { cosineSimilarity } from "./utils";
import {
  EmbeddingBase,
  GptQuestionEmbedding,
  Embeddable,
  ChatInteraction,
} from "./types";
import { Marked } from "./utils";
import { ask } from "./utils";
import { Plugins } from "./plugins/plugins";
import { queryEmbedding, getConfiguredEmbeddingMap } from "./embeddings";
import { Agents } from "./services/AgentService";
import { FlagsService } from "./services/flags";
import { IAgent } from "./agents/interface";
import { Clients, Message } from "./clients";
import { recordAudio, voiceToText } from "./microphone";
import { Models } from "./ai";

enum ChatFlags {
  agent = "agent",
  agents = "agents",
  debug = "debug",
  multi = "multi",
  search = "search",
  clear = "clear",
  provider = "provider",
  voice = "voice",
}

const Flags = new FlagsService(
  [ChatFlags.agent, ChatFlags.debug, ChatFlags.multi, ChatFlags.voice],
  true
);

export async function askEmbedding<E>(promptText: string) {
  const options = ["next", "exit", "embeddings", "use"];
  console.log(`Commands: ${options.join(", ")}`);
  let input = await ask(promptText + ": ", options);
  let answer: EmbeddingBase<any> | undefined;
  let results = new Array<EmbeddingBase>();
  let embedMap = await getConfiguredEmbeddingMap();
  const files = Object.keys(embedMap);

  while (input !== "exit") {
    const embeddings = Object.values(embedMap).flat();

    switch (input) {
      case "next":
        answer = results.shift();
        break;
      case "embeddings":
        console.log(files);
        break;
      case "use":
        const searchOptions = ["all", ...files];
        console.log(searchOptions);
        const embeddingName = await ask("Embedding to search: ", searchOptions);
        if (embeddingName === "all") {
          embedMap = await getConfiguredEmbeddingMap();
          break;
        }

        embedMap = { ...{ [embeddingName]: embedMap[embeddingName] } };
        break;
      default:
        results = await queryEmbedding(input, embeddings);
        answer = results.shift();
        break;
    }
    if (answer) {
      console.log(
        Marked.parse(
          "### TEXT \n" +
            answer.text +
            "\n### METADATA \n" +
            JSON.stringify(answer.metadata, null, 2)
        )
      );
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

const chatModels = {
  openai: Models.openai.GPT_4o,
  anthropic: Models.anthropic.Sonnet,
};
export async function askAI<E extends EmbeddingBase>(
  query: string,
  provider = "openai"
) {
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
  ] as Message[];

  const response = await Clients.createCompletion(provider, {
    messages: thread,
    max_tokens: 2500,
    model: chatModels[provider],
  });

  return response.choices[0].message.content;
}

export async function getInput(
  question: string,
  options = [],
  chatHistory: ChatInteraction[] = []
): Promise<string> {
  const multiLine = Flags.enabled(ChatFlags.multi);
  const voice = Flags.enabled(ChatFlags.voice);

  let value = "";
  if (voice) {
    value = await voiceToText();
  } else if (multiLine) {
    value = await editor({ message: question });
  } else {
    const history = chatHistory.map((c) => c.input);
    value = await ask(question, options, history.reverse());
  }

  return value.trim();
}

export async function formatChatInput(
  input: string,
  plugins: string[] = [],
  chatHistory: ChatInteraction[] = []
) {
  const pluginText = await Plugins.callMany(plugins, input);
  const historyMessage = `PREVIOUS CHAT INTERACTIONS: \n ${JSON.stringify(
    chatHistory
  )}\n`;
  const fullPrompt = `${historyMessage} \n ${input} \n ${pluginText}`;
  return fullPrompt;
}

export async function chatLoop<E extends GptQuestionEmbedding>(
  aiName: string,
  embeddings: Embeddable<E>[],
  plugins: string[] = []
) {
  let activeAgent: IAgent = Agents.getAgent("Developer");
  let provider = "openai" as keyof typeof Clients.clients;
  const providers = Object.keys(Clients.clients);
  const commands = [
    "agent",
    "agents",
    "debugger",
    "exit",
    "multi",
    "search",
    "clear",
    "provider",
    "voice",
  ];
  console.log("Commands: ", commands.join(", "));
  const promptText = () =>
    Flags.enabled(ChatFlags.agent)
      ? `\nAsk ${aiName} ${activeAgent.name}: `
      : `\nAsk ${aiName}: `;

  let chatHistory = new Array<ChatInteraction>();
  let input = await getInput(promptText(), commands, chatHistory);

  let results = "";
  while (input !== "exit") {
    try {
      switch (input) {
        case ChatFlags.agents:
          Flags.enable(ChatFlags.agent);
          const agents = Agents.listAgents();
          console.log(agents);
          const selected = await ask(
            "Which agent would you like to use: ",
            agents
          );
          activeAgent = Agents.getAgent(selected);
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
        case ChatFlags.voice:
          Flags.flip(ChatFlags.voice);
          break;
        case ChatFlags.search:
          await askEmbedding("searching");
          break;
        case ChatFlags.clear:
          chatHistory = [];
          break;
        case ChatFlags.provider:
          console.log(providers);
          provider = await ask(
            "Which provider would you like to use: ",
            providers
          );
          break;
        case "":
          break;
        default:
          console.log("Thinking...");
          console.log(input);
          const formattedPrompt = await formatChatInput(
            input,
            plugins,
            chatHistory
          );
          const interaction = { input, output: "" } as ChatInteraction;
          if (Flags.enabled("agent")) {
            results = await activeAgent.call(formattedPrompt);
          } else {
            results = await askAI(formattedPrompt, provider);
          }
          interaction.output = results;
          console.log("\n\n");
          console.log(Marked.parse(results || "No response from the AI"));
          chatHistory.push(interaction);
          break;
      }
    } catch (e) {
      console.log(e);
    } finally {
      input = await getInput(promptText(), commands, chatHistory);
    }
  }
}

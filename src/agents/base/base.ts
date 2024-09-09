import { Message, Tool, ToolCall } from "../../clients/types";
import { IAgent } from "../interface";
import { ToolsService, Tools } from "../../services/Tools";
import { replaceEscapedNewLines, restoreEscapedNewLines } from "../../utils";
import { Agents, AgentService } from "../../services/AgentService";
import { Events, EventService } from "../../services/EventService";
import { AIClient, Clients } from "../../clients";
import { Models, openai } from "../../ai";

export interface ModelPreference {
  model: string;
  provider: keyof typeof Clients.clients;
}

export abstract class BaseAgent implements IAgent {
  abstract name: string;
  abstract description: string;

  private lastHealthCheckTime: number = 0;
  protected provider = "openai";
  protected modelName: string = Models.openai.GPT_4o;
  protected modelPreferences: ModelPreference[] = [];
  protected currentModelPreferenceIndex = 0;

  disabledTools = [];

  constructor(
    public tools: ToolsService = Tools,
    public events: EventService = Events
  ) {}

  register() {
    this.events.registerAgent(this);
  }

  getModel(): string {
    return this.modelName;
  }

  setModelPreferences(value: ModelPreference[]) {
    this.modelPreferences = value;
    if (value.length) {
      this.updatePreferences(value[0]);
    }
  }

  updatePreferences(value: ModelPreference) {
    this.setModel(value.model);
    this.setProvider(value.provider);
  }

  nextModel() {
    this.currentModelPreferenceIndex++;
    if (this.currentModelPreferenceIndex >= this.modelPreferences.length) {
      throw new Error("We have exhausted all model preferences.");
    }
    const nextModel = this.modelPreferences[this.currentModelPreferenceIndex];
    this.updatePreferences(nextModel);
  }

  setModel(value: string) {
    this.modelName = value;
  }

  getProvider() {
    return this.provider;
  }

  setProvider(value: keyof typeof Clients.clients) {
    this.provider = value;
  }

  getClient() {
    return Clients.getClient(this.provider);
  }

  getEnabledTools() {
    return this.tools
      .getTools()
      .filter((t) => !this.disabledTools.includes(t.function.name));
  }

  getEnabledToolNames() {
    return this.getEnabledTools().map((t) => t.function.name);
  }

  disableTool(toolName: string) {
    this.disabledTools.push(toolName);
  }

  isToolEnabled(toolName: string) {
    return !!this.getEnabledTools().find((t) => t.function.name === toolName);
  }

  enableTool(toolName: string) {
    if (!this.isToolEnabled(toolName)) {
      this.disabledTools = this.disabledTools.filter((t) => t !== toolName);
    }
  }

  abstract getInitialMessages(userInput: string): Promise<Message[]>;

  async processToolMessages(toolCall: ToolCall) {
    const functionName = toolCall.function.name;
    const functionToCall = this.tools.getFunction(functionName);

    console.log(toolCall);
    const functionArgs = JSON.parse(
      this.formatAiResponse(toolCall.function.arguments)
    );

    const toJsonIfObject = (arg: any) => {
      if (typeof arg === "object") {
        return JSON.stringify(arg, null, 2);
      }
      return arg;
    };

    const toolDefinition = this.tools.getTool(functionName);
    const properties = toolDefinition?.function?.parameters?.properties || {};
    const positionalArgs = Object.keys(properties).map((p) => functionArgs[p]);

    console.log(
      `Calling function ${functionName} with args:`,
      JSON.stringify(positionalArgs, null, 2)
    );

    if (!functionToCall) {
      const options = this.getEnabledToolNames().join(", ");
      const error = `Function ${functionName} not found, options are ${options}`;
      console.log(error);
      return [
        {
          tool_call_id: toolCall.id,
          role: "tool",
          name: "error",
          content: error,
        },
      ];
    }

    const functionResponse = await Promise.resolve(
      functionToCall(...positionalArgs)
    ).catch((e) => e.message);
    let toolMessages = [];

    if (functionName === "multi_tool_use.parallel") {
      const args = positionalArgs[0] as {
        recipient_name: string;
        parameters: any;
      }[];

      toolMessages = args.map((call, index) => {
        return {
          tool_call_id: toolCall.id + "_" + index,
          role: "tool",
          name: call.recipient_name.split(".").pop(),
          content: toJsonIfObject(functionResponse[index]) || "Done",
        };
      });
    }

    toolMessages = [
      {
        tool_call_id: toolCall.id,
        role: "tool",
        name: functionName,
        content: toJsonIfObject(functionResponse) || "Done",
      },
    ];

    console.log(toolMessages);

    return toolMessages;
  }

  logMessages(messages: Message[]) {
    for (const message of messages) {
      if (message.role === "assistant") {
        console.log(message.content);
      }
    }
  }

  formatInputContent(userInput: string) {
    return replaceEscapedNewLines(userInput);
  }

  formatAiResponse(response: string) {
    return restoreEscapedNewLines(response);
  }

  formatInputMessages(messages: Message[]) {
    return messages.map((m) => ({
      ...m,
      content:
        typeof m.content === "string"
          ? this.formatInputContent(m.content)
          : m.content,
    })) as Message[];
  }

  formatOutputMessages(messages: Message[]) {
    return messages.map((m) => ({
      ...m,
      content:
        typeof m.content === "string"
          ? this.formatAiResponse(m.content)
          : m.content,
    })) as Message[];
  }

  async healthCheck() {
    try {
      const canCallProvider = await this.getClient().createChatCompletion({
        messages: [{ role: "user", content: "Hello!" }],
        model: this.getModel(),
        max_tokens: 2,
      });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async selectHealthyModel() {
    const currentTime = Date.now();
    if (currentTime - this.lastHealthCheckTime < 60 * 1000) {
      return;
    }

    let healthy = await this.healthCheck();
    this.lastHealthCheckTime = Date.now();
    while (!healthy) {
      this.nextModel();
      healthy = await this.healthCheck();
    }
    await this.healthCheck();
  }

  setNotHealthy() {
    this.lastHealthCheckTime = 0;
  }

  async call(userInput: string, _messages?: Message[]) {
    await this.selectHealthyModel();

    try {
      const model = this.getModel();
      let messages = _messages || (await this.getInitialMessages(userInput));
      messages = this.formatInputMessages(messages);

      const startIndex = 0;
      const endIndex = messages.length;
      const compressThreshold = 5000;

      const response = await this.getClient().createChatCompletion({
        model,
        messages,
        tools: this.getEnabledTools(),
        tool_choice: "auto",
      });

      this.logMessages(response.choices.map((c) => c.message));

      const firstMessage = response.choices[0].message;
      const newToolCalls = response.choices.flatMap(
        (c) => c.message.tool_calls
      );

      for (const choice of response.choices) {
        const responseMessage = choice.message;
        console.log(responseMessage);

        const toolCalls = responseMessage.tool_calls;
        if (responseMessage.tool_calls) {
          // extend conversation with assistant's reply
          messages.push(responseMessage);

          for (const toolCall of toolCalls) {
            const toolMessages = await this.processToolMessages(toolCall);
            // Add the tool responses to the thread
            messages.push(...(toolMessages as Message[]));

            const finalMessage = toolMessages.find(
              (m) => m.name === "finalAnswer"
            );

            if (finalMessage) {
              return finalMessage.content || "Done";
            }
          }
        }
      }

      /*
       *    if (response.choices.length === 1 && firstMessage.content) {
       *      return firstMessage.content;
       *    }
       *
       */

      if (this.getMessagesLength(messages) > compressThreshold) {
        messages = await this.compressMessages(messages, startIndex, endIndex);
      }

      if (messages[messages.length - 1].role === "assistant") {
        // sometimes the agent just says a message and doesn't call a tool
        messages.push({
          role: "user",
          content: "Workflow continues until you call finalAnswer.",
        });
      }

      return this.call(userInput, messages);
    } catch (e) {
      if (e.toString().includes("429")) {
        this.setNotHealthy();
        return this.call(userInput, _messages);
      }

      console.error(e);
      return e.message;
    }
  }

  getMessagesLength(messages: Message[]) {
    return JSON.stringify(messages).split(" ").length;
  }

  async compressMessages(
    messages: Message[],
    startIndex: number,
    endIndex: number
  ) {
    const toCompress = messages.slice(startIndex, endIndex);
    const toCompressPrompt = `Summarize:
    1. Initial Request - what this agent was tasked with.
    2. Progress - what has been tried so far,
    3. Next Steps - what we're about to do next to continue the user's original request.

      This summary will become the agent's only memory of the past, all other messages will be dropped: \n\n${JSON.stringify(
        toCompress
      )}`;

    const model = this.getModel();

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "assistant",
          content: toCompressPrompt,
        },
      ],
    });

    const startMessages = [
      {
        role: "user",
        content: "We have just compressed the conversation to save memory.",
      },
    ] as Message[];
    const systemMesasges = toCompress.filter((m) => m.role === "system");

    const newMessages = [
      ...systemMesasges,
      ...startMessages,
      ...response.choices.map((c) => c.message),
      ...messages.slice(endIndex),
    ];

    const oldLength = this.getMessagesLength(messages);
    const newLength = this.getMessagesLength(newMessages);
    const compressionRatio = (
      ((oldLength - newLength) / oldLength) *
      100
    ).toFixed(2);

    console.log(
      "Compressed messages from",
      oldLength,
      "to",
      newLength,
      compressionRatio + "%",
      "reduction in size"
    );

    return newMessages;
  }
}

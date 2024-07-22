import { Researcher } from "../agents/researcher/researcher";
import { Developer } from "../agents/codebase/codebase";
import { getConfigSync } from "../config";
import { IAgent } from "../agents/interface";
import { OpenAIAgent } from "../agents/configurable/OpenAIAgent";
import { ConfigAgent } from "../agents/configurable/ConfigAgent";
// import { Tools } from "./Tools";

class AgentService {
  private agents: Map<string, IAgent> = new Map();

  constructor() {
    this.registerAgent(Researcher);
    this.registerAgent(Developer);
    this.loadAgentsFromConfig();

    const agentNames = this.listAgents().join(", ");
    /*
     *Tools.addTool({
     *  type: "function",
     *  function: {
     *    name: "agentCall",
     *    description:
     *      "Allows an agent to ask another agent a question. Useful for getting help from agents that are configured for specific goals.",
     *    parameters: {
     *      type: "object",
     *      properties: {
     *        agentName: {
     *          type: "string",
     *          description: `The name of the agent to call. Available agents: ${agentNames}`,
     *        },
     *        query: {
     *          type: "string",
     *          description: `The query to send to the agent`,
     *        },
     *      },
     *      required: ["agentName", "query"],
     *    },
     *  },
     *});
     */
  }

  public registerAgent(agent: IAgent): void {
    this.registerAgentByName(agent.name, agent);
  }

  public registerAgentByName(name: string, agent: IAgent): void {
    this.agents.set(name, agent);
  }

  public getAgent(name: string): IAgent {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Agent ${name} not found`);
    }
    return agent;
  }

  public listAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  public loadAgentsFromConfig() {
    const config = getConfigSync();
    const assistants = config.assistants || [];

    for (const assistant of assistants) {
      if (assistant.model) {
        if (!assistant.id) {
          console.error(
            `Cannot register assistant: ${assistant.name}. Need to upload the assistant to openai first. Call knowhow upload:openai\n`
          );
          continue;
        }
        this.registerAgent(new OpenAIAgent(assistant));
      } else {
        this.registerAgent(new ConfigAgent(assistant));
      }
    }
  }

  public async callAgent(name: string, query: string): Promise<string> {
    const agent = this.agents.get(name);
    if (!agent) {
      return "Agent not found";
    }
    return agent.call(query);
  }
}

export const agentService = new AgentService();

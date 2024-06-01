import { IAgent } from "../agents/base/base";
import { OpenAIAgent } from "../agents/OpenAIAgent";
import { ConfigAgent } from "../agents/ConfigAgent";
import { Researcher } from "../agents/researcher/researcher";
import { Developer } from "../agents/codebase/codebase";
import { getConfigSync } from "../config";
import { Tools } from "../agents/tools/list";

class AgentService {
  private agents: Map<string, IAgent> = new Map();

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
            `Cannot register ${assistant.name}. Need to upload the assistant to openai first. Call knowhow upload:openai\n`
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

agentService.registerAgent(Researcher);
agentService.registerAgent(Developer);
agentService.loadAgentsFromConfig();

const agentNames = agentService.listAgents().join(", ");
Tools.addTool({
  type: "function",
  function: {
    name: "agentCall",
    description:
      "Allows an agent to ask another agent a question. Useful for getting help from agents that are configured for specific goals.",
    parameters: {
      type: "object",
      properties: {
        agentName: {
          type: "string",
          description: `The name of the agent to call. Available agents: ${agentNames}`,
        },
        query: {
          type: "string",
          description: `The query to send to the agent`,
        },
      },
      required: ["agentName", "query"],
    },
  },
});

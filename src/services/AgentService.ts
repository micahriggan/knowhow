import { IAgent } from "../agents/base/base";
import { OpenAIAgent } from "../agents/OpenAIAgent";
import { ConfigAgent } from "../agents/ConfigAgent";
import { Researcher } from "../agents/researcher/researcher";
import { Developer } from "../agents/codebase/codebase";
import { getConfigSync } from "../config";

class AgentService {
  private agents: Map<string, IAgent> = new Map();

  public registerAgent(agent: IAgent): void {
    this.registerAgentByName(agent.name, agent);
  }

  public registerAgentByName(name: string, agent: IAgent): void {
    this.agents.set(name, agent);
  }

  public getAgent(name: string): IAgent | undefined {
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
            `Cannot register ${assistant.name}.\nNeed to upload the assistant to openai first. \nCall knowhow upload:openai`
          );
          continue;
        }
        this.registerAgent(new OpenAIAgent(assistant));
      } else {
        this.registerAgent(new ConfigAgent(assistant));
      }
    }
  }

  public async callAgent(
    name: string,
    query: string,
    chatHistory = []
  ): Promise<string> {
    const agent = this.agents.get(name);
    if (!agent) {
      return "Agent not found";
    }
    return agent.call(query, chatHistory);
  }
}

export const agentService = new AgentService();

agentService.registerAgent(Researcher);
agentService.registerAgent(Developer);
agentService.loadAgentsFromConfig();

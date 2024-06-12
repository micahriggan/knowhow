import { agentService } from "../../services/AgentService";

// I want to do this, but circular dependencies are a problem
export async function agentCall(agentName: string, userInput: string) {
  return agentService.callAgent(agentName, userInput);
}

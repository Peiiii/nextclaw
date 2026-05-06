import { nextclawClient } from "./client.service";
import type { AgentCreateRequest, AgentDeleteResult, AgentProfileView, AgentUpdateRequest } from "@/shared/lib/api/types";

export async function fetchAgents(): Promise<{ agents: AgentProfileView[] }> {
  return { agents: await nextclawClient.agents.list() };
}

export async function createAgent(data: AgentCreateRequest): Promise<AgentProfileView> {
  return await nextclawClient.agents.create(data);
}

export async function updateAgent(agentId: string, data: AgentUpdateRequest): Promise<AgentProfileView> {
  return await nextclawClient.agents.update(agentId, data);
}

export async function deleteAgent(agentId: string): Promise<AgentDeleteResult> {
  return await nextclawClient.agents.delete(agentId);
}

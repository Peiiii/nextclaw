import { api } from "./client";
import type { AgentCreateRequest, AgentDeleteResult, AgentProfileView, AgentUpdateRequest } from "./types";

export async function fetchAgents(): Promise<{ agents: AgentProfileView[] }> {
  const response = await api.get<{ agents: AgentProfileView[] }>("/api/agents");
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function createAgent(data: AgentCreateRequest): Promise<AgentProfileView> {
  const response = await api.post<AgentProfileView>("/api/agents", data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function updateAgent(agentId: string, data: AgentUpdateRequest): Promise<AgentProfileView> {
  const response = await api.put<AgentProfileView>(`/api/agents/${encodeURIComponent(agentId)}`, data);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function deleteAgent(agentId: string): Promise<AgentDeleteResult> {
  const response = await api.delete<AgentDeleteResult>(`/api/agents/${encodeURIComponent(agentId)}`);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

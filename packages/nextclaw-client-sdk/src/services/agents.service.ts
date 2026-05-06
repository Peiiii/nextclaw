import type { AgentCreateRequest, AgentDeleteResult, AgentProfileView, AgentUpdateRequest } from "@nextclaw/server";
import { resolveApiUrl } from "../utils/url.utils.js";
import type { RequestService } from "./request.service.js";

export class AgentsService {
  constructor(private readonly requestService: RequestService, private readonly baseUrl: string) {}

  readonly list = async (): Promise<AgentProfileView[]> => {
    const data = await this.requestService.get<{ agents: AgentProfileView[] }>("/api/agents");
    return data.agents;
  };

  readonly create = async (data: AgentCreateRequest): Promise<AgentProfileView> => {
    return await this.requestService.post<AgentProfileView>("/api/agents", data);
  };

  readonly update = async (agentId: string, data: AgentUpdateRequest): Promise<AgentProfileView> => {
    return await this.requestService.put<AgentProfileView>(`/api/agents/${encodeURIComponent(agentId)}`, data);
  };

  readonly delete = async (agentId: string): Promise<AgentDeleteResult> => {
    return await this.requestService.delete<AgentDeleteResult>(`/api/agents/${encodeURIComponent(agentId)}`);
  };

  readonly resolveAvatarUrl = (agentId: string): string => {
    return resolveApiUrl(this.baseUrl, `/api/agents/${encodeURIComponent(agentId)}/avatar`);
  };
}

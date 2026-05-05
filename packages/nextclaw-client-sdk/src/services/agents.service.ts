import type { NextClawAgentList, NextClawAgentProfile } from "../types/agent.types.js";
import { resolveApiUrl } from "../utils/url.utils.js";
import type { RequestService } from "./request.service.js";

export class AgentsService {
  constructor(private readonly requestService: RequestService, private readonly baseUrl: string) {}

  readonly list = async (): Promise<NextClawAgentProfile[]> => {
    const data = await this.requestService.request<NextClawAgentList>("/api/agents");
    return data.agents;
  };

  readonly resolveAvatarUrl = (agentId: string): string => {
    return resolveApiUrl(this.baseUrl, `/api/agents/${encodeURIComponent(agentId)}/avatar`);
  };
}

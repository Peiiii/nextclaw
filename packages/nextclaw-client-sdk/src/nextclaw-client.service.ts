import type { NextClawClientOptions } from "./types/client-sdk.types.js";
import { normalizeBaseUrl } from "./utils/url.utils.js";
import { AgentsService } from "./services/agents.service.js";
import { RealtimeService } from "./services/realtime.service.js";
import { RequestService } from "./services/request.service.js";
import { SessionsService } from "./services/sessions.service.js";

export class NextClawClientService {
  readonly baseUrl: string;
  readonly agents: AgentsService;
  readonly realtime: RealtimeService;
  readonly sessions: SessionsService;

  constructor(options: NextClawClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    const normalizedOptions = {
      ...options,
      baseUrl: this.baseUrl
    };
    const requestService = new RequestService(normalizedOptions);
    this.realtime = new RealtimeService(normalizedOptions);
    this.agents = new AgentsService(requestService, this.baseUrl);
    this.sessions = new SessionsService(requestService, this.realtime);
  }
}

export function createNextClawClient(options: NextClawClientOptions): NextClawClientService {
  return new NextClawClientService(options);
}

import type { NextClawSessionList, NextClawSessionMessages, NextClawSessionSummary } from "../types/session.types.js";
import type { NextClawRealtimeHandler, NextClawRealtimeSubscribeOptions } from "../types/client-sdk.types.js";
import type { NextClawRealtimeSubscription } from "../types/realtime.types.js";
import type { RealtimeService } from "./realtime.service.js";
import type { RequestService } from "./request.service.js";

export class SessionsService {
  constructor(
    private readonly requestService: RequestService,
    private readonly realtimeService: RealtimeService
  ) {}

  readonly list = async (): Promise<NextClawSessionList> => {
    return await this.requestService.request<NextClawSessionList>("/api/ncp/sessions");
  };

  readonly get = async (sessionId: string): Promise<NextClawSessionSummary> => {
    return await this.requestService.request<NextClawSessionSummary>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}`
    );
  };

  readonly listMessages = async (sessionId: string, limit = 200): Promise<NextClawSessionMessages> => {
    return await this.requestService.request<NextClawSessionMessages>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}/messages?limit=${Math.max(1, Math.trunc(limit))}`
    );
  };

  readonly subscribe = (
    handler: NextClawRealtimeHandler,
    options: NextClawRealtimeSubscribeOptions = {}
  ): NextClawRealtimeSubscription => {
    return this.realtimeService.subscribe(handler, options);
  };
}

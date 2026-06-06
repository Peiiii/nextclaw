import type {
  NcpSessionSkillsView,
  SessionPatchUpdate,
  UiNcpAssetPutView,
  UiNcpSessionListView,
  UiNcpSessionMessagesView
} from "@nextclaw/server";
import type { EventBus } from "@nextclaw/shared";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import type { NextClawRealtimeHandler, NextClawRealtimeSubscribeOptions } from "../types/nextclaw-request.types.js";
import type { NextClawRealtimeSubscription } from "../types/nextclaw-realtime.types.js";
import type { RequestService } from "./request.service.js";

export class SessionsService {
  constructor(
    private readonly requestService: RequestService,
    private readonly eventBus: EventBus
  ) {}

  readonly list = async (params?: { limit?: number; peerId?: string }): Promise<UiNcpSessionListView> => {
    const { limit, peerId: rawPeerId } = params ?? {};
    const query = new URLSearchParams();
    if (typeof limit === "number" && Number.isFinite(limit)) {
      query.set("limit", String(Math.max(1, Math.trunc(limit))));
    }
    const peerId = rawPeerId?.trim();
    if (peerId) {
      query.set("peerId", peerId);
    }
    return await this.requestService.get<UiNcpSessionListView>("/api/ncp/sessions", {
      ...(query.size > 0 ? { query } : {})
    });
  };

  readonly get = async (sessionId: string): Promise<NcpSessionSummary> => {
    return await this.requestService.get<NcpSessionSummary>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}`
    );
  };

  readonly listMessages = async (sessionId: string, limit = 200): Promise<UiNcpSessionMessagesView> => {
    return await this.requestService.get<UiNcpSessionMessagesView>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        query: { limit: Math.max(1, Math.trunc(limit)) }
      }
    );
  };

  readonly listSkills = async (
    sessionId: string,
    params?: { projectRoot?: string | null }
  ): Promise<NcpSessionSkillsView> => {
    return await this.requestService.get<NcpSessionSkillsView>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}/skills`,
      {
        query: params?.projectRoot?.trim() ? { projectRoot: params.projectRoot.trim() } : undefined
      }
    );
  };

  readonly update = async (sessionId: string, patch: SessionPatchUpdate): Promise<NcpSessionSummary> => {
    return await this.requestService.put<NcpSessionSummary>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}`,
      patch
    );
  };

  readonly delete = async (sessionId: string): Promise<{ deleted: boolean; sessionId: string }> => {
    return await this.requestService.delete<{ deleted: boolean; sessionId: string }>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}`
    );
  };

  readonly uploadAssets = async (files: readonly File[]): Promise<UiNcpAssetPutView> => {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    return await this.requestService.upload<UiNcpAssetPutView>("/api/ncp/assets", formData);
  };

  readonly subscribe = (
    handler: NextClawRealtimeHandler,
    _options: NextClawRealtimeSubscribeOptions = {}
  ): NextClawRealtimeSubscription => {
    const unsubscribe = this.eventBus.subscribeAll((event) => {
      handler(event);
    });
    return {
      close: unsubscribe
    };
  };
}

import type {
  NcpSessionContextCompactionView,
  NcpSessionSkillsView,
  SessionPatchUpdate,
  UiNcpAssetPutView,
  UiNcpSessionListView,
  UiNcpSessionMessagesView,
  UiNcpSessionQueuedInputView,
  UiNcpSessionQueuedInputsView,
  UiNcpSessionPendingInputView,
  UiNcpSessionPendingInputsView,
  UiNcpSessionTokenUsageView,
} from "@nextclaw/server";
import type { EventBus } from "@nextclaw/shared";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import type { NextClawRealtimeHandler, NextClawRealtimeSubscribeOptions } from "../types/nextclaw-request.types.js";
import type { NextClawRealtimeSubscription } from "../types/nextclaw-realtime.types.js";
import type { RequestService } from "./request.service.js";

export type ListSessionMessagesParams = {
  limit?: number;
  cursor?: string;
  toolPayload?: "summary";
  initialPayload?: "compact";
  signal?: AbortSignal;
};

export class SessionsService {
  constructor(
    private readonly requestService: RequestService,
    private readonly eventBus: EventBus
  ) {}

  readonly list = async (params?: { limit?: number; page?: number; pageSize?: number; query?: string; peerId?: string }): Promise<UiNcpSessionListView> => {
    const { limit, page, pageSize, query: rawQuery, peerId: rawPeerId } = params ?? {};
    const query = new URLSearchParams();
    if (typeof limit === "number" && Number.isFinite(limit)) {
      query.set("limit", String(Math.max(1, Math.trunc(limit))));
    }
    if (typeof page === "number" && Number.isFinite(page)) query.set("page", String(Math.max(1, Math.trunc(page))));
    if (typeof pageSize === "number" && Number.isFinite(pageSize)) query.set("pageSize", String(Math.max(1, Math.trunc(pageSize))));
    if (rawQuery?.trim()) query.set("query", rawQuery.trim());
    const peerId = rawPeerId?.trim();
    if (peerId) {
      query.set("peerId", peerId);
    }
    return await this.requestService.get<UiNcpSessionListView>("/api/ncp/sessions", {
      ...(query.size > 0 ? { query } : {})
    });
  };

  readonly get = async (sessionId: string): Promise<NcpSessionSummary> => {
    return await this.requestService.get<NcpSessionSummary>(`/api/ncp/sessions/${encodeURIComponent(sessionId)}`);
  };

  readonly listMessages = async (
    sessionId: string,
    options: number | ListSessionMessagesParams = {}
  ): Promise<UiNcpSessionMessagesView> => {
    const params = typeof options === "number" ? { limit: options } : options;
    const query = new URLSearchParams();
    if (typeof params.limit === "number" && Number.isFinite(params.limit)) {
      query.set("limit", String(Math.max(1, Math.trunc(params.limit))));
    }
    if (params.cursor?.trim()) {
      query.set("cursor", params.cursor.trim());
    }
    if (params.toolPayload === "summary") {
      query.set("toolPayload", "summary");
    }
    if (params.initialPayload === "compact") {
      query.set("initialPayload", "compact");
    }
    return await this.requestService.get<UiNcpSessionMessagesView>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        ...(query.size > 0 ? { query } : {}),
        ...(params.signal ? { signal: params.signal } : {})
      }
    );
  };

  readonly getUsage = async (sessionId: string): Promise<UiNcpSessionTokenUsageView> => {
    return await this.requestService.get<UiNcpSessionTokenUsageView>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}/usage`,
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

  readonly listQueuedInputs = async (
    sessionId: string,
  ): Promise<UiNcpSessionQueuedInputsView> => {
    return await this.requestService.get<UiNcpSessionQueuedInputsView>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}/queued-inputs`,
    );
  };

  readonly deleteQueuedInput = async (
    sessionId: string,
    queuedInputId: string,
  ): Promise<UiNcpSessionQueuedInputView> => {
    return await this.requestService.delete<UiNcpSessionQueuedInputView>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}/queued-inputs/${encodeURIComponent(queuedInputId)}`,
    );
  };

  readonly listPendingInputs = async (
    sessionId: string,
  ): Promise<UiNcpSessionPendingInputsView> => {
    return await this.requestService.get<UiNcpSessionPendingInputsView>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}/pending-inputs`,
    );
  };

  readonly steerQueuedInput = async (
    sessionId: string,
    queuedInputId: string,
  ): Promise<UiNcpSessionPendingInputView> => {
    return await this.requestService.post<UiNcpSessionPendingInputView>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}/queued-inputs/${encodeURIComponent(queuedInputId)}/steer`,
    );
  };

  readonly update = async (sessionId: string, patch: SessionPatchUpdate): Promise<NcpSessionSummary> => {
    return await this.requestService.put<NcpSessionSummary>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}`,
      patch
    );
  };

  readonly compactContext = async (
    sessionId: string,
  ): Promise<NcpSessionContextCompactionView> => {
    return await this.requestService.post<NcpSessionContextCompactionView>(
      `/api/ncp/sessions/${encodeURIComponent(sessionId)}/context/compact`,
    );
  };

  readonly delete = async (sessionId: string): Promise<{ deleted: boolean; sessionId: string }> => {
    return await this.requestService.delete<{
      deleted: boolean;
      sessionId: string;
    }>(`/api/ncp/sessions/${encodeURIComponent(sessionId)}`);
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

import type {
  ListMessagesOptions,
  ListSessionsOptions,
  NcpMessage,
  NcpSessionApi,
  NcpSessionPatch,
  NcpSessionSummary,
} from "@nextclaw/ncp";
import type { Config, SessionManager } from "@nextclaw/core";
import type { AgentSessionRecord, AgentSessionStore } from "@nextclaw/ncp-toolkit";
import { ContextCompactionPreflightService } from "@kernel/features/context-compaction/index.js";
import { createNcpSessionSummary } from "@kernel/utils/ncp-session-summary.utils.js";
import { eventKeys, type EventBus, type Unsubscribe } from "@nextclaw/shared";

type NcpAgentSessionReadableStore = AgentSessionStore & {
  listSessionSummaries?: () => Promise<NcpSessionSummary[]>;
  listSessionMessages?: (sessionId: string) => Promise<NcpMessage[]>;
};

function applyLimit<T>(items: T[], limit?: number): T[] {
  if (!Number.isFinite(limit) || typeof limit !== "number" || limit <= 0) {
    return items;
  }
  return items.slice(0, Math.trunc(limit));
}

function formatBackgroundTaskError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

function buildUpdatedMetadata(params: {
  existingMetadata?: Record<string, unknown>;
  patch: NcpSessionPatch;
}): Record<string, unknown> {
  const { existingMetadata, patch } = params;
  if (patch.metadata === null) {
    return {};
  }
  if (patch.metadata) {
    return structuredClone(patch.metadata);
  }
  return structuredClone(existingMetadata ?? {});
}

function normalizeSessionId(sessionId: string): string {
  return sessionId.trim();
}

function readSummaryActivityAt(summary: NcpSessionSummary): string {
  return summary.lastMessageAt ?? summary.createdAt ?? summary.updatedAt;
}

export type NcpSessionApiServiceOptions = {
  eventBus: EventBus;
  getConfig: () => Config;
  isLiveSessionRunning?: (sessionId: string) => boolean;
  ncpAgentSessionStore: NcpAgentSessionReadableStore;
  sessionManager: SessionManager;
};

export class NcpSessionApiService implements NcpSessionApi {
  private unsubscribeSessionUpdated: Unsubscribe | null = null;
  private readonly contextWindowPreview: ContextCompactionPreflightService;

  constructor(private readonly options: NcpSessionApiServiceOptions) {
    this.contextWindowPreview = new ContextCompactionPreflightService({
      getConfig: options.getConfig,
      sessionManager: options.sessionManager,
    });
  }

  start = (): void => {
    if (this.unsubscribeSessionUpdated) {
      return;
    }
    this.unsubscribeSessionUpdated = this.options.eventBus.on(eventKeys.sessionUpdated, ({ sessionKey }) => {
      void this.publishSessionChange(sessionKey).catch((error) => {
        console.error(
          `[session-realtime] failed to publish session change for ${sessionKey}: ${formatBackgroundTaskError(error)}`
        );
      });
    });
  };

  dispose = (): void => {
    this.unsubscribeSessionUpdated?.();
    this.unsubscribeSessionUpdated = null;
  };

  publishSessionChange = async (sessionKey: string): Promise<void> => {
    const normalizedSessionKey = normalizeSessionId(sessionKey);
    if (!normalizedSessionKey) {
      return;
    }
    const summary = await this.getSession(normalizedSessionKey);
    if (summary) {
      this.options.eventBus.emit(eventKeys.sessionSummaryUpsert, { summary });
      return;
    }
    this.options.eventBus.emit(eventKeys.sessionSummaryDelete, {
      sessionKey: normalizedSessionKey,
    });
  };

  listSessions = async (options?: ListSessionsOptions): Promise<NcpSessionSummary[]> => {
    const summaries = this.options.ncpAgentSessionStore.listSessionSummaries
      ? await this.options.ncpAgentSessionStore.listSessionSummaries()
      : (await this.options.ncpAgentSessionStore.listSessions())
        .map((record) => this.createSummaryFromRecord(record))
        .sort((left, right) => readSummaryActivityAt(right).localeCompare(readSummaryActivityAt(left)));
    return applyLimit(summaries, options?.limit).map(this.withLiveSessionStatus);
  };

  listSessionMessages = async (
    sessionId: string,
    options?: ListMessagesOptions,
  ): Promise<NcpMessage[]> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      return [];
    }
    if (this.options.ncpAgentSessionStore.listSessionMessages) {
      return applyLimit(
        await this.options.ncpAgentSessionStore.listSessionMessages(normalizedSessionId),
        options?.limit,
      );
    }
    const session = await this.options.ncpAgentSessionStore.getSession(normalizedSessionId);
    return applyLimit(
      session?.messages.map((message) => structuredClone(message)) ?? [],
      options?.limit,
    );
  };

  getSession = async (sessionId: string): Promise<NcpSessionSummary | null> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      return null;
    }
    const record = await this.options.ncpAgentSessionStore.getSession(normalizedSessionId);
    return record ? this.withLiveSessionStatus(this.createSummaryFromRecord(record, true)) : null;
  };

  updateSession = async (
    sessionId: string,
    patch: NcpSessionPatch,
  ): Promise<NcpSessionSummary | null> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      return null;
    }
    const existing = await this.options.ncpAgentSessionStore.getSession(normalizedSessionId);
    if (!existing) {
      return null;
    }
    await this.options.ncpAgentSessionStore.updateSessionMetadata({
      sessionId: normalizedSessionId,
      metadata: buildUpdatedMetadata({
        existingMetadata: existing.metadata,
        patch,
      }),
      updatedAt: new Date().toISOString(),
    });
    await this.publishSessionChange(normalizedSessionId);
    return await this.getSession(normalizedSessionId);
  };

  deleteSession = async (sessionId: string): Promise<void> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      return;
    }
    await this.options.ncpAgentSessionStore.deleteSession(normalizedSessionId);
    await this.publishSessionChange(normalizedSessionId);
  };

  private createSummaryFromRecord = (
    record: AgentSessionRecord,
    includeContextWindow = false,
  ): NcpSessionSummary => createNcpSessionSummary({
    sessionId: record.sessionId,
    agentId: record.agentId,
    messages: record.messages,
    createdAt: record.createdAt ?? record.updatedAt,
    updatedAt: record.updatedAt,
    status: "idle",
    metadata: record.metadata,
    contextWindow: includeContextWindow
      ? this.contextWindowPreview.preview({
        contextWindowOwner: "nextclaw",
        requestMetadata: record.metadata ?? {},
        sessionId: record.sessionId,
        sessionMessages: record.messages,
      })
      : undefined,
  });

  private withLiveSessionStatus = (summary: NcpSessionSummary): NcpSessionSummary => this.options.isLiveSessionRunning?.(summary.sessionId) ? { ...summary, status: "running" } : summary;
}

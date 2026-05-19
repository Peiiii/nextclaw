import type {
  ListMessagesOptions,
  ListSessionsOptions,
  NcpMessage,
  NcpSessionApi,
  NcpSessionPatch,
  NcpSessionSummary,
} from "@nextclaw/ncp";
import type { Config, SessionListRecord, SessionManager } from "@nextclaw/core";
import type { AgentSessionStore } from "@nextclaw/ncp-toolkit";
import { ContextCompactionPreflightService } from "@kernel/features/native-runtime/index.js";
import { toNcpMessages } from "@kernel/utils/ncp-session-message-adapter.utils.js";
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

type SessionListSummaryRecord = SessionListRecord & {
  messageCount?: number;
  lastMessageAt?: string;
};

function createSessionListSummary(record: SessionListSummaryRecord & { sessionId: string }): NcpSessionSummary {
  return {
    sessionId: record.sessionId,
    ...(record.agentId ? { agentId: record.agentId } : {}),
    messageCount: record.messageCount ?? 0,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    ...(record.lastMessageAt ? { lastMessageAt: record.lastMessageAt } : {}),
    status: "idle",
    metadata: structuredClone(record.metadata),
  };
}

export type NcpSessionApiServiceOptions = {
  eventBus: EventBus;
  getConfig: () => Config;
  isLiveSessionRunning?: (sessionId: string) => boolean;
  ncpAgentSessionStore?: NcpAgentSessionReadableStore;
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
    if (this.options.ncpAgentSessionStore?.listSessionSummaries) {
      return applyLimit(
        await this.options.ncpAgentSessionStore.listSessionSummaries(),
        options?.limit,
      ).map(this.withLiveSessionStatus);
    }
    const records = applyLimit(
      this.options.sessionManager.listSessions()
        .map((record) => ({ ...record, sessionId: normalizeSessionId(record.key) }))
        .filter((record): record is SessionListSummaryRecord & { sessionId: string } => Boolean(record))
        .sort((left, right) => (right.lastMessageAt ?? right.created_at).localeCompare(left.lastMessageAt ?? left.created_at)),
      options?.limit,
    );
    return records.map(createSessionListSummary).map(this.withLiveSessionStatus);
  };

  listSessionMessages = async (
    sessionId: string,
    options?: ListMessagesOptions,
  ): Promise<NcpMessage[]> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (normalizedSessionId && this.options.ncpAgentSessionStore?.listSessionMessages) {
      return applyLimit(
        await this.options.ncpAgentSessionStore.listSessionMessages(normalizedSessionId),
        options?.limit,
      );
    }
    const session = normalizedSessionId
      ? this.options.sessionManager.getIfExists(normalizedSessionId)
      : null;
    if (!session) {
      return [];
    }
    return applyLimit(
      toNcpMessages(normalizedSessionId, session.messages).map((message) =>
        structuredClone(message)
      ),
      options?.limit,
    );
  };

  getSession = async (sessionId: string): Promise<NcpSessionSummary | null> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (normalizedSessionId && this.options.ncpAgentSessionStore?.getSession) {
      const record = await this.options.ncpAgentSessionStore.getSession(normalizedSessionId);
      if (record) {
        return this.withLiveSessionStatus(createNcpSessionSummary({
          sessionId: normalizedSessionId,
          agentId: record.agentId,
          messages: record.messages,
          createdAt: record.createdAt ?? record.updatedAt,
          updatedAt: record.updatedAt,
          status: "idle",
          metadata: record.metadata,
          contextWindow: this.contextWindowPreview.preview({
            contextWindowOwner: "nextclaw",
            requestMetadata: record.metadata ?? {},
            sessionId: normalizedSessionId,
            sessionMessages: record.messages,
          }),
        }));
      }
    }
    const session = normalizedSessionId
      ? this.options.sessionManager.getIfExists(normalizedSessionId)
      : null;
    if (!session) {
      return null;
    }
    const messages = toNcpMessages(normalizedSessionId, session.messages);
    return this.withLiveSessionStatus(createNcpSessionSummary({
      sessionId: normalizedSessionId,
      agentId: session.agentId,
      messages,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      status: "idle",
      metadata: session.metadata,
      contextWindow: this.contextWindowPreview.preview({
        contextWindowOwner: "nextclaw",
        requestMetadata: session.metadata,
        sessionId: normalizedSessionId,
        sessionMessages: messages,
      }),
    }));
  };

  updateSession = async (
    sessionId: string,
    patch: NcpSessionPatch,
  ): Promise<NcpSessionSummary | null> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (normalizedSessionId && this.options.ncpAgentSessionStore) {
      const existing = await this.options.ncpAgentSessionStore.getSession(normalizedSessionId);
      if (existing) {
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
      }
    }
    const session = normalizedSessionId
      ? this.options.sessionManager.getIfExists(normalizedSessionId)
      : null;
    if (!session) {
      return null;
    }
    session.metadata = buildUpdatedMetadata({
      existingMetadata: session.metadata,
      patch,
    });
    session.updatedAt = new Date();
    this.options.sessionManager.save(session);
    await this.publishSessionChange(normalizedSessionId);
    return await this.getSession(normalizedSessionId);
  };

  deleteSession = async (sessionId: string): Promise<void> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      return;
    }
    if (this.options.ncpAgentSessionStore) {
      await this.options.ncpAgentSessionStore.deleteSession(normalizedSessionId);
    }
    this.options.sessionManager.delete(normalizedSessionId);
    await this.publishSessionChange(normalizedSessionId);
  };

  private withLiveSessionStatus = (summary: NcpSessionSummary): NcpSessionSummary => this.options.isLiveSessionRunning?.(summary.sessionId) ? { ...summary, status: "running" } : summary;
}

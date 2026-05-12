import type {
  ListMessagesOptions,
  ListSessionsOptions,
  NcpMessage,
  NcpSessionApi,
  NcpSessionPatch,
  NcpSessionSummary,
} from "@nextclaw/ncp";
import type { Config, SessionManager } from "@nextclaw/core";
import { ContextCompactionPreflightService } from "@kernel/features/native-runtime";
import { toNcpMessages } from "@kernel/utils/ncp-session-message-adapter.utils.js";
import { createNcpSessionSummary } from "@kernel/utils/ncp-session-summary.utils.js";
import { eventKeys, type EventBus, type Unsubscribe } from "@nextclaw/shared";

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

export type NcpSessionApiServiceOptions = {
  eventBus: EventBus;
  getConfig: () => Config;
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
    const summaries: NcpSessionSummary[] = [];
    for (const record of this.options.sessionManager.listSessions()) {
      const sessionId = normalizeSessionId(record.key);
      if (!sessionId) {
        continue;
      }
      const session = this.options.sessionManager.getIfExists(sessionId);
      if (!session) {
        continue;
      }
      summaries.push(
        createNcpSessionSummary({
          sessionId,
          agentId: session.agentId,
          messages: toNcpMessages(sessionId, session.messages),
          updatedAt: session.updatedAt.toISOString(),
          status: "idle",
          metadata: session.metadata,
        }),
      );
    }
    summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return applyLimit(summaries, options?.limit);
  };

  listSessionMessages = async (
    sessionId: string,
    options?: ListMessagesOptions,
  ): Promise<NcpMessage[]> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
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
    const session = normalizedSessionId
      ? this.options.sessionManager.getIfExists(normalizedSessionId)
      : null;
    if (!session) {
      return null;
    }
    const messages = toNcpMessages(normalizedSessionId, session.messages);
    return createNcpSessionSummary({
      sessionId: normalizedSessionId,
      agentId: session.agentId,
      messages,
      updatedAt: session.updatedAt.toISOString(),
      status: "idle",
      metadata: session.metadata,
      contextWindow: this.contextWindowPreview.preview({
        contextWindowOwner: "nextclaw",
        requestMetadata: session.metadata,
        sessionId: normalizedSessionId,
        sessionMessages: messages,
      }),
    });
  };

  updateSession = async (
    sessionId: string,
    patch: NcpSessionPatch,
  ): Promise<NcpSessionSummary | null> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
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
    this.options.sessionManager.delete(normalizedSessionId);
    await this.publishSessionChange(normalizedSessionId);
  };
}

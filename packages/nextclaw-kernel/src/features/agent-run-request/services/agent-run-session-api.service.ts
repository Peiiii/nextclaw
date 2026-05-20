import {
  type ListMessagesOptions,
  type ListSessionsOptions,
  type NcpMessage,
  type NcpSessionApi,
  type NcpSessionPatch,
  type NcpSessionSummary,
} from "@nextclaw/ncp";
import type {
  AgentSessionRecord,
  AgentSessionStore,
} from "@nextclaw/ncp-toolkit";
import type { ContextCompactionPreflightService } from "@kernel/features/context-compaction/index.js";
import {
  applyLimit,
  buildUpdatedMetadata,
  disposeRuntime,
  type LiveSession,
  readMessages,
  toSessionSummary,
} from "@kernel/features/agent-run-request/utils/agent-run-request-session.utils.js";

export type AgentRunSessionApiServiceOptions = {
  liveSessions: Map<string, LiveSession>;
  sessionStore: AgentSessionStore;
  contextWindowPreview: ContextCompactionPreflightService;
  onSessionUpdated: (sessionKey: string) => void;
};

export class AgentRunSessionApiService implements NcpSessionApi {
  constructor(private readonly options: AgentRunSessionApiServiceOptions) {}

  isLiveSessionRunning = (sessionId: string): boolean =>
    Boolean(this.options.liveSessions.get(sessionId)?.activeExecution);

  listSessions = async (options?: ListSessionsOptions): Promise<NcpSessionSummary[]> => {
    const storedSummaries = this.options.sessionStore.listSessionSummaries
      ? await this.options.sessionStore.listSessionSummaries()
      : (await this.options.sessionStore.listSessions()).map((session) =>
          toSessionSummary({
            sessionId: session.sessionId,
            agentId: session.agentId,
            messages: session.messages,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            metadata: session.metadata,
            running: this.isLiveSessionRunning(session.sessionId),
          }),
        );
    const summaries = [...storedSummaries];
    for (const liveSession of this.options.liveSessions.values()) {
      const index = summaries.findIndex((summary) => summary.sessionId === liveSession.sessionId);
      if (index >= 0) {
        summaries[index] = {
          ...summaries[index],
          status: liveSession.activeExecution ? "running" : "idle",
        };
        continue;
      }
      summaries.push(this.createLiveSessionSummary(liveSession));
    }
    return applyLimit(
      summaries.sort((left, right) =>
        (right.lastMessageAt ?? right.createdAt ?? right.updatedAt).localeCompare(
          left.lastMessageAt ?? left.createdAt ?? left.updatedAt,
        ),
      ),
      options?.limit,
    );
  };

  listSessionMessages = async (
    sessionId: string,
    options?: ListMessagesOptions,
  ): Promise<NcpMessage[]> => {
    const normalizedSessionId = sessionId.trim();
    const liveSession = this.options.liveSessions.get(normalizedSessionId);
    if (liveSession) {
      return applyLimit(readMessages(liveSession), options?.limit);
    }
    const messages = this.options.sessionStore.listSessionMessages
      ? await this.options.sessionStore.listSessionMessages(normalizedSessionId)
      : (await this.options.sessionStore.getSession(normalizedSessionId))?.messages ?? [];
    return applyLimit(messages.map((message) => structuredClone(message)), options?.limit);
  };

  getSession = async (sessionId: string): Promise<NcpSessionSummary | null> => {
    const normalizedSessionId = sessionId.trim();
    const liveSession = this.options.liveSessions.get(normalizedSessionId) ?? null;
    const storedSession = await this.options.sessionStore.getSession(normalizedSessionId);
    if (!liveSession && !storedSession) {
      return null;
    }
    if (liveSession) {
      return this.createLiveSessionSummary(liveSession, storedSession ?? undefined);
    }
    return storedSession ? this.createStoredSessionSummary(storedSession) : null;
  };

  updateSession = async (
    sessionId: string,
    patch: NcpSessionPatch,
  ): Promise<NcpSessionSummary | null> => {
    const normalizedSessionId = sessionId.trim();
    const storedSession = await this.options.sessionStore.getSession(normalizedSessionId);
    const liveSession = this.options.liveSessions.get(normalizedSessionId) ?? null;
    if (!storedSession && !liveSession) {
      return null;
    }
    const metadata = buildUpdatedMetadata({
      existingMetadata: liveSession?.metadata ?? storedSession?.metadata,
      patch,
    });
    if (liveSession) {
      liveSession.metadata = structuredClone(metadata);
    }
    await this.options.sessionStore.updateSessionMetadata({
      sessionId: normalizedSessionId,
      metadata,
      updatedAt: new Date().toISOString(),
    });
    this.options.onSessionUpdated(normalizedSessionId);
    return await this.getSession(normalizedSessionId);
  };

  deleteSession = async (sessionId: string): Promise<void> => {
    const normalizedSessionId = sessionId.trim();
    const liveSession = this.options.liveSessions.get(normalizedSessionId) ?? null;
    if (liveSession) {
      liveSession.activeExecution?.controller.abort();
      liveSession.publisher.close();
      await disposeRuntime(liveSession.runtime);
      this.options.liveSessions.delete(normalizedSessionId);
    }
    await this.options.sessionStore.deleteSession(normalizedSessionId);
    this.options.onSessionUpdated(normalizedSessionId);
  };

  private createStoredSessionSummary = (
    session: AgentSessionRecord,
  ): NcpSessionSummary => toSessionSummary({
    sessionId: session.sessionId,
    agentId: session.agentId,
    messages: session.messages,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    metadata: session.metadata,
    running: this.isLiveSessionRunning(session.sessionId),
    contextWindow: this.options.contextWindowPreview.preview({
      contextWindowOwner: "nextclaw",
      requestMetadata: session.metadata ?? {},
      sessionId: session.sessionId,
      sessionMessages: session.messages,
    }),
  });

  private createLiveSessionSummary = (
    session: LiveSession,
    storedSession?: AgentSessionRecord,
  ): NcpSessionSummary => {
    const messages = readMessages(session);
    const metadata = {
      ...(storedSession?.metadata ? structuredClone(storedSession.metadata) : {}),
      ...structuredClone(session.metadata),
    };
    return toSessionSummary({
      sessionId: session.sessionId,
      agentId: session.agentId ?? storedSession?.agentId,
      messages,
      createdAt: storedSession?.createdAt ?? session.createdAt,
      updatedAt: new Date().toISOString(),
      metadata,
      running: Boolean(session.activeExecution),
      contextWindow: this.options.contextWindowPreview.preview({
        contextWindowOwner: "nextclaw",
        requestMetadata: metadata,
        sessionId: session.sessionId,
        sessionMessages: messages,
      }),
    });
  };
}

import type { SessionManager } from "@nextclaw/core";
import type {
  ListMessagesOptions,
  ListSessionsOptions,
  NcpMessage,
  NcpSessionApi,
  NcpSessionPatch,
  NcpSessionSummary
} from "@nextclaw/ncp";
import { NextclawAgentSessionStore } from "./nextclaw-agent-session-store.js";
import { createNcpSessionSummary } from "./ncp-session-summary.js";

function applyLimit<T>(items: T[], limit?: number): T[] {
  if (!Number.isFinite(limit) || typeof limit !== "number" || limit <= 0) {
    return items;
  }
  return items.slice(0, Math.trunc(limit));
}

function now(): string {
  return new Date().toISOString();
}

function buildUpdatedMetadata(params: {
  existingMetadata?: Record<string, unknown>;
  patch: NcpSessionPatch;
}): Record<string, unknown> {
  if (params.patch.metadata === null) {
    return {};
  }
  if (params.patch.metadata) {
    return structuredClone(params.patch.metadata);
  }
  return structuredClone(params.existingMetadata ?? {});
}

export class UiSessionService implements NcpSessionApi {
  private readonly sessionStore: NextclawAgentSessionStore;

  constructor(
    sessionManager: SessionManager,
    options: {
      onSessionUpdated?: (sessionKey: string) => void;
    } = {},
  ) {
    this.sessionStore = new NextclawAgentSessionStore(sessionManager, {
      onSessionUpdated: options.onSessionUpdated,
    });
  }

  listSessions = async (options?: ListSessionsOptions): Promise<NcpSessionSummary[]> => {
    const sessions = await this.sessionStore.listSessions();
    return applyLimit(
      sessions.map((session) =>
        createNcpSessionSummary({
          sessionId: session.sessionId,
          agentId: session.agentId,
          messages: session.messages,
          updatedAt: session.updatedAt,
          status: "idle",
          metadata: session.metadata
        })
      ),
      options?.limit
    );
  };

  listSessionMessages = async (
    sessionId: string,
    options?: ListMessagesOptions,
  ): Promise<NcpMessage[]> => {
    const session = await this.sessionStore.getSession(sessionId);
    if (!session) {
      return [];
    }
    return applyLimit(session.messages.map((message) => structuredClone(message)), options?.limit);
  };

  getSession = async (sessionId: string): Promise<NcpSessionSummary | null> => {
    const session = await this.sessionStore.getSession(sessionId);
    if (!session) {
      return null;
    }
    return createNcpSessionSummary({
      sessionId,
      agentId: session.agentId,
      messages: session.messages,
      updatedAt: session.updatedAt,
      status: "idle",
      metadata: session.metadata
    });
  };

  updateSession = async (
    sessionId: string,
    patch: NcpSessionPatch,
  ): Promise<NcpSessionSummary | null> => {
    const session = await this.sessionStore.getSession(sessionId);
    await this.sessionStore.replaceSession({
      sessionId,
      messages: session
        ? session.messages.map((message) => structuredClone(message))
        : [],
      updatedAt: now(),
      metadata: buildUpdatedMetadata({
        existingMetadata: session?.metadata,
        patch
      })
    });
    return await this.getSession(sessionId);
  };

  deleteSession = async (sessionId: string): Promise<void> => {
    await this.sessionStore.deleteSession(sessionId);
  };
}

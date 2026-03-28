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

function applyLimit<T>(items: T[], limit?: number): T[] {
  if (!Number.isFinite(limit) || typeof limit !== "number" || limit <= 0) {
    return items;
  }
  return items.slice(0, Math.trunc(limit));
}

function now(): string {
  return new Date().toISOString();
}

function toSessionSummary(params: {
  sessionId: string;
  messages: NcpMessage[];
  updatedAt: string;
  metadata?: Record<string, unknown>;
}): NcpSessionSummary {
  return {
    sessionId: params.sessionId,
    messageCount: params.messages.length,
    updatedAt: params.updatedAt,
    status: "idle",
    ...(params.metadata ? { metadata: structuredClone(params.metadata) } : {})
  };
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

  constructor(sessionManager: SessionManager) {
    this.sessionStore = new NextclawAgentSessionStore(sessionManager);
  }

  async listSessions(options?: ListSessionsOptions): Promise<NcpSessionSummary[]> {
    const sessions = await this.sessionStore.listSessions();
    return applyLimit(
      sessions.map((session) =>
        toSessionSummary({
          sessionId: session.sessionId,
          messages: session.messages,
          updatedAt: session.updatedAt,
          metadata: session.metadata
        })
      ),
      options?.limit
    );
  }

  async listSessionMessages(sessionId: string, options?: ListMessagesOptions): Promise<NcpMessage[]> {
    const session = await this.sessionStore.getSession(sessionId);
    if (!session) {
      return [];
    }
    return applyLimit(session.messages.map((message) => structuredClone(message)), options?.limit);
  }

  async getSession(sessionId: string): Promise<NcpSessionSummary | null> {
    const session = await this.sessionStore.getSession(sessionId);
    if (!session) {
      return null;
    }
    return toSessionSummary({
      sessionId,
      messages: session.messages,
      updatedAt: session.updatedAt,
      metadata: session.metadata
    });
  }

  async updateSession(sessionId: string, patch: NcpSessionPatch): Promise<NcpSessionSummary | null> {
    const session = await this.sessionStore.getSession(sessionId);
    if (!session) {
      return null;
    }
    await this.sessionStore.saveSession({
      sessionId,
      messages: session.messages.map((message) => structuredClone(message)),
      updatedAt: now(),
      metadata: buildUpdatedMetadata({
        existingMetadata: session.metadata,
        patch
      })
    });
    return await this.getSession(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sessionStore.deleteSession(sessionId);
  }
}

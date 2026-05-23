import type { SessionManager } from "@nextclaw/core";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { toNcpMessages } from "@kernel/utils/ncp-session-message-adapter.utils.js";

export class NcpAgentLegacySessionStore {
  constructor(private readonly sessionManager: SessionManager) {}

  getSession = (sessionId: string): AgentSessionRecord | null => {
    const session = this.sessionManager.getIfExists(sessionId);
    if (!session) {
      return null;
    }
    return {
      sessionId,
      ...(session.agentId ? { agentId: session.agentId } : {}),
      messages: toNcpMessages(sessionId, session.messages),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      metadata: structuredClone(session.metadata),
    };
  };

  listSessionMessages = (sessionId: string) => this.getSession(sessionId)?.messages ?? [];

  listSessionSummaries = () => this.sessionManager.listSessions().map((record) => ({
      sessionId: record.key,
      ...(record.agentId ? { agentId: record.agentId } : {}),
      messageCount: record.messageCount ?? 0,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      ...(record.lastMessageAt ? { lastMessageAt: record.lastMessageAt } : {}),
      status: "idle" as const,
      metadata: structuredClone(record.metadata),
    }));

  deleteSession = (sessionId: string): AgentSessionRecord | null => {
    const existing = this.getSession(sessionId);
    if (!existing) {
      return null;
    }
    this.sessionManager.delete(sessionId);
    return existing;
  };
}

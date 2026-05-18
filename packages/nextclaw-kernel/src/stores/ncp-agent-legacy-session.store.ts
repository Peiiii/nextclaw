import type { SessionManager } from "@nextclaw/core";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { ensureIsoTimestamp, normalizeString, toLegacyMessages } from "@kernel/utils/ncp-message-bridge.utils.js";
import { resolveLegacyEventType, toNcpMessages } from "@kernel/utils/ncp-session-message-adapter.utils.js";
import { resolvePersistedSessionMetadata } from "@kernel/utils/ncp-session-metadata.utils.js";

function resolveSessionRecordAgentId(record: AgentSessionRecord): string | undefined {
  return normalizeString(record.agentId)?.toLowerCase()
    ?? normalizeString(record.metadata?.agent_id)?.toLowerCase()
    ?? normalizeString(record.metadata?.agentId)?.toLowerCase();
}

export class NcpAgentLegacySessionStore {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly options: { onSessionUpdated?: (sessionKey: string) => void } = {},
  ) {}

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

  saveSession = (sessionRecord: AgentSessionRecord): Promise<void> => this.persistSession(sessionRecord, true);

  replaceSession = (sessionRecord: AgentSessionRecord): Promise<void> => this.persistSession(sessionRecord, false);

  deleteSession = (sessionId: string): AgentSessionRecord | null => {
    const existing = this.getSession(sessionId);
    if (!existing) {
      return null;
    }
    this.sessionManager.delete(sessionId);
    this.options.onSessionUpdated?.(sessionId);
    return existing;
  };

  private persistSession = async (
    sessionRecord: AgentSessionRecord,
    preserveExistingMetadata: boolean,
  ): Promise<void> => {
    const session = this.sessionManager.getIfExists(sessionRecord.sessionId) ?? this.sessionManager.getOrCreate(sessionRecord.sessionId);
    const legacyMessages = toLegacyMessages(sessionRecord.messages);
    const nextAgentId = resolveSessionRecordAgentId(sessionRecord);
    if (nextAgentId) {
      session.agentId = nextAgentId;
    }
    if (sessionRecord.createdAt) {
      session.createdAt = new Date(ensureIsoTimestamp(sessionRecord.createdAt, session.createdAt.toISOString()));
    }
    session.metadata = resolvePersistedSessionMetadata({
      currentMetadata: session.metadata,
      sessionRecord,
      preserveExistingMetadata,
    });

    this.sessionManager.clear(session);
    for (const message of legacyMessages) {
      this.sessionManager.appendEvent(session, {
        type: resolveLegacyEventType(message),
        timestamp: ensureIsoTimestamp(message.timestamp, new Date().toISOString()),
        data: { message },
      });
    }

    if (legacyMessages.length === 0) {
      session.updatedAt = new Date(ensureIsoTimestamp(sessionRecord.updatedAt, new Date().toISOString()));
    }

    this.sessionManager.save(session);
    this.options.onSessionUpdated?.(sessionRecord.sessionId);
  };
}

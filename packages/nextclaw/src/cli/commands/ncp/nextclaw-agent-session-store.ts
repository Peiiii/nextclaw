import type { SessionManager, SessionMessage } from "@nextclaw/core";
import type { AgentSessionRecord, AgentSessionStore } from "@nextclaw/ncp-toolkit";
import {
  ensureIsoTimestamp,
  normalizeString,
  toLegacyMessages,
} from "./nextclaw-ncp-message-bridge.js";
import {
  resolveLegacyEventType,
  toNcpMessages,
} from "./nextclaw-agent-session-message-adapter.js";
import { resolvePersistedSessionMetadata } from "./nextclaw-agent-session-metadata.utils.js";

function readAgentIdFromMetadata(metadata: Record<string, unknown> | undefined): string | undefined {
  return normalizeString(metadata?.agent_id)?.toLowerCase() ?? normalizeString(metadata?.agentId)?.toLowerCase() ?? undefined;
}

function resolveSessionRecordAgentId(record: AgentSessionRecord): string | undefined {
  return normalizeString(record.agentId)?.toLowerCase() ?? readAgentIdFromMetadata(record.metadata);
}

export class NextclawAgentSessionStore implements AgentSessionStore {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly options: {
      writeMode?: "ncp-state" | "runtime-owned";
      onSessionUpdated?: (sessionKey: string) => void;
    } = {},
  ) {}

  getSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const session = this.sessionManager.getIfExists(sessionId);
    if (!session) {
      return null;
    }
    return {
      sessionId,
      ...(session.agentId ? { agentId: session.agentId } : {}),
      messages: toNcpMessages(sessionId, session.messages),
      updatedAt: session.updatedAt.toISOString(),
      metadata: structuredClone(session.metadata)
    };
  };

  listSessions = async (): Promise<AgentSessionRecord[]> => {
    const records = this.sessionManager.listSessions();
    const sessions: AgentSessionRecord[] = [];
    for (const record of records) {
      const sessionId = normalizeString(record.key);
      if (!sessionId) {
        continue;
      }
      const session = this.sessionManager.getIfExists(sessionId);
      if (!session) {
        continue;
      }
      sessions.push({
        sessionId,
        ...(session.agentId ? { agentId: session.agentId } : {}),
        messages: toNcpMessages(sessionId, session.messages),
        updatedAt: session.updatedAt.toISOString(),
        metadata: structuredClone(session.metadata)
      });
    }

    sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return sessions;
  };

  private persistSession = async (
    sessionRecord: AgentSessionRecord,
    options: {
      preserveExistingMetadata: boolean;
    },
  ): Promise<void> => {
    if (this.options.writeMode === "runtime-owned") {
      return;
    }
    const session = this.sessionManager.getIfExists(sessionRecord.sessionId) ?? this.sessionManager.getOrCreate(sessionRecord.sessionId);
    const legacyMessages = toLegacyMessages(sessionRecord.messages);
    const nextAgentId = resolveSessionRecordAgentId(sessionRecord);
    if (nextAgentId) {
      session.agentId = nextAgentId;
    }
    session.metadata = resolvePersistedSessionMetadata({
      currentMetadata: session.metadata,
      sessionRecord,
      preserveExistingMetadata: options.preserveExistingMetadata,
    });

    this.sessionManager.clear(session);
    for (const message of legacyMessages) {
      this.sessionManager.appendEvent(session, {
        type: resolveLegacyEventType(message),
        timestamp: ensureIsoTimestamp(message.timestamp, new Date().toISOString()),
        data: {
          message
        }
      });
    }

    if (legacyMessages.length === 0) {
      session.updatedAt = new Date(ensureIsoTimestamp(sessionRecord.updatedAt, new Date().toISOString()));
    }

    this.sessionManager.save(session);
    this.options.onSessionUpdated?.(sessionRecord.sessionId);
  };

  saveSession = async (sessionRecord: AgentSessionRecord): Promise<void> => {
    await this.persistSession(sessionRecord, {
      preserveExistingMetadata: true,
    });
  };

  replaceSession = async (sessionRecord: AgentSessionRecord): Promise<void> => {
    await this.persistSession(sessionRecord, {
      preserveExistingMetadata: false,
    });
  };

  deleteSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const existing = await this.getSession(sessionId);
    if (!existing) {
      return null;
    }
    this.sessionManager.delete(sessionId);
    this.options.onSessionUpdated?.(sessionId);
    return existing;
  };
}

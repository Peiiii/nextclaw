import type { SessionManager } from "@nextclaw/core";
import type { AgentSessionEventRecord, AgentSessionRecord, AgentSessionStore } from "@nextclaw/ncp-toolkit";
import type { NcpEndpointEvent, NcpMessage, NcpSessionSummary } from "@nextclaw/ncp";
import { NcpEventType } from "@nextclaw/ncp";
import {
  ensureIsoTimestamp,
  normalizeString,
  toLegacyMessages,
} from "@kernel/utils/ncp-message-bridge.utils.js";
import {
  resolveLegacyEventType,
  toNcpMessages,
} from "@kernel/utils/ncp-session-message-adapter.utils.js";
import { resolvePersistedSessionMetadata } from "@kernel/utils/ncp-session-metadata.utils.js";
import type { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";

function readAgentIdFromMetadata(metadata: Record<string, unknown> | undefined): string | undefined {
  return normalizeString(metadata?.agent_id)?.toLowerCase() ?? normalizeString(metadata?.agentId)?.toLowerCase() ?? undefined;
}

function resolveSessionRecordAgentId(record: AgentSessionRecord): string | undefined {
  return normalizeString(record.agentId)?.toLowerCase() ?? readAgentIdFromMetadata(record.metadata);
}

function readSessionActivityAt(record: AgentSessionRecord): string {
  return record.messages.at(-1)?.timestamp ?? record.createdAt ?? record.updatedAt;
}

export class NcpAgentSessionStoreAdapter implements AgentSessionStore {
  appendSessionEvent?: AgentSessionStore["appendSessionEvent"];

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly options: {
      journalStore?: NcpAgentSessionJournalStore;
      writeMode?: "ncp-state" | "runtime-owned";
      onSessionUpdated?: (sessionKey: string) => void;
    } = {},
  ) {
    const journalStore = options.journalStore;
    if (journalStore) {
      this.appendSessionEvent = async (params: {
        session: AgentSessionEventRecord;
        event: NcpEndpointEvent;
        updatedAt: string;
      }): Promise<void> => {
        const { event, session } = params;
        if (!await journalStore.hasSession(session.sessionId)) {
          const legacySession = this.readLegacySessionRecord(session.sessionId);
          if (legacySession) {
            await journalStore.replaceSession(legacySession);
          }
        }
        await journalStore.appendSessionEvent(params);
        if (isSessionSummaryRefreshEvent(event)) {
          this.options.onSessionUpdated?.(session.sessionId);
        }
      };
    }
  }

  getSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const journalSession = await this.options.journalStore?.getSession(sessionId);
    if (journalSession) {
      return journalSession;
    }
    return this.readLegacySessionRecord(sessionId);
  };

  private readLegacySessionRecord = (sessionId: string): AgentSessionRecord | null => {
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
      metadata: structuredClone(session.metadata)
    };
  };

  getSessionSummary = async (sessionId: string): Promise<NcpSessionSummary | null> => {
    const journalSummary = await this.options.journalStore?.getSessionSummary(sessionId);
    if (journalSummary) {
      return journalSummary;
    }
    const session = this.sessionManager.getIfExists(sessionId);
    if (!session) {
      return null;
    }
    const messages = toNcpMessages(sessionId, session.messages);
    const lastMessageAt = messages.at(-1)?.timestamp;
    return {
      sessionId,
      ...(session.agentId ? { agentId: session.agentId } : {}),
      messageCount: messages.length,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      ...(lastMessageAt ? { lastMessageAt } : {}),
      status: "idle",
      metadata: structuredClone(session.metadata),
    };
  };

  listSessionMessages = async (sessionId: string): Promise<NcpMessage[]> => {
    const journalStore = this.options.journalStore;
    if (journalStore && await journalStore.hasSession(sessionId)) {
      return await journalStore.listSessionMessages(sessionId);
    }
    const session = this.sessionManager.getIfExists(sessionId);
    return session
      ? toNcpMessages(sessionId, session.messages).map((message) => structuredClone(message))
      : [];
  };

  listSessionSummaries = async (): Promise<NcpSessionSummary[]> => {
    const journalSummaries = await this.options.journalStore?.listSessionSummaries() ?? [];
    const journalIds = new Set(journalSummaries.map((summary) => summary.sessionId));
    const legacySummaries = this.sessionManager.listSessions()
      .filter((record) => !journalIds.has(record.key))
      .map((record) => ({
        sessionId: record.key,
        ...(record.agentId ? { agentId: record.agentId } : {}),
        messageCount: record.messageCount ?? 0,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        ...(record.lastMessageAt ? { lastMessageAt: record.lastMessageAt } : {}),
        status: "idle" as const,
        metadata: structuredClone(record.metadata),
      }));
    return [...journalSummaries, ...legacySummaries]
      .sort((left, right) => readSummaryActivityAt(right).localeCompare(readSummaryActivityAt(left)));
  };

  listSessions = async (): Promise<AgentSessionRecord[]> => {
    const summaries = await this.listSessionSummaries();
    const sessions: AgentSessionRecord[] = [];
    for (const summary of summaries) {
      const sessionId = normalizeString(summary.sessionId);
      if (!sessionId) {
        continue;
      }
      const session = await this.getSession(sessionId);
      if (!session) {
        continue;
      }
      sessions.push(session);
    }

    sessions.sort((left, right) => readSessionActivityAt(right).localeCompare(readSessionActivityAt(left)));
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
    if (sessionRecord.createdAt) {
      session.createdAt = new Date(ensureIsoTimestamp(sessionRecord.createdAt, session.createdAt.toISOString()));
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
    const journalStore = this.options.journalStore;
    if (journalStore && await journalStore.hasSession(sessionRecord.sessionId)) {
      await journalStore.replaceSession(sessionRecord);
      this.options.onSessionUpdated?.(sessionRecord.sessionId);
      return;
    }
    await this.persistSession(sessionRecord, {
      preserveExistingMetadata: true,
    });
  };

  replaceSession = async (sessionRecord: AgentSessionRecord): Promise<void> => {
    const journalStore = this.options.journalStore;
    if (journalStore && await journalStore.hasSession(sessionRecord.sessionId)) {
      await journalStore.replaceSession(sessionRecord);
      this.options.onSessionUpdated?.(sessionRecord.sessionId);
      return;
    }
    await this.persistSession(sessionRecord, {
      preserveExistingMetadata: false,
    });
  };

  deleteSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const existing = await this.options.journalStore?.deleteSession(sessionId) ?? await this.getSession(sessionId);
    if (!existing) {
      return null;
    }
    this.sessionManager.delete(sessionId);
    this.options.onSessionUpdated?.(sessionId);
    return existing;
  };
}

function readSummaryActivityAt(summary: NcpSessionSummary): string {
  return summary.lastMessageAt ?? summary.createdAt ?? summary.updatedAt;
}

function isSessionSummaryRefreshEvent(event: NcpEndpointEvent): boolean {
  switch (event.type) {
    case NcpEventType.MessageSent:
    case NcpEventType.MessageCompleted:
    case NcpEventType.MessageAbort:
    case NcpEventType.RunFinished:
    case NcpEventType.RunError:
      return true;
    default:
      return false;
  }
}

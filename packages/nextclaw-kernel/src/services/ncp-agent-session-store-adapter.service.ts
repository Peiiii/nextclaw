import type { SessionManager } from "@nextclaw/core";
import type { AgentSessionEventRecord, AgentSessionRecord, AgentSessionStore } from "@nextclaw/ncp-toolkit";
import type { NcpEndpointEvent, NcpMessage, NcpSessionSummary } from "@nextclaw/ncp";
import { NcpEventType } from "@nextclaw/ncp";
import { NcpAgentLegacySessionStore } from "@kernel/stores/ncp-agent-legacy-session.store.js";
import type { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";

function readSessionActivityAt(record: AgentSessionRecord): string {
  return record.messages.at(-1)?.timestamp ?? record.createdAt ?? record.updatedAt;
}

export class NcpAgentSessionStoreAdapter implements AgentSessionStore {
  private readonly legacyStore: NcpAgentLegacySessionStore;
  private readonly journalStore: NcpAgentSessionJournalStore;

  constructor(
    sessionManager: SessionManager,
    private readonly options: {
      journalStore: NcpAgentSessionJournalStore;
      onSessionUpdated?: (sessionKey: string) => void;
    },
  ) {
    this.legacyStore = new NcpAgentLegacySessionStore(sessionManager, {
      onSessionUpdated: options.onSessionUpdated,
    });
    this.journalStore = options.journalStore;
  }

  appendSessionEvent = async (params: {
    session: AgentSessionEventRecord;
    event: NcpEndpointEvent;
    updatedAt: string;
  }): Promise<void> => {
    const { event, session } = params;
    if (!await this.journalStore.hasSession(session.sessionId)) {
      const legacySession = this.legacyStore.getSession(session.sessionId);
      if (legacySession) {
        await this.journalStore.importSessionSnapshot(legacySession);
      }
    }
    await this.journalStore.appendSessionEvent(params);
    if (isSessionSummaryRefreshEvent(event)) {
      this.options.onSessionUpdated?.(session.sessionId);
    }
  };

  getSession = async (sessionId: string): Promise<AgentSessionRecord | null> =>
    await this.journalStore.getSession(sessionId) ?? this.legacyStore.getSession(sessionId);

  listSessionMessages = async (sessionId: string): Promise<NcpMessage[]> => {
    return await this.journalStore.hasSession(sessionId)
      ? await this.journalStore.listSessionMessages(sessionId)
      : this.legacyStore.listSessionMessages(sessionId);
  };

  listSessionSummaries = async (): Promise<NcpSessionSummary[]> => {
    const journalSummaries = await this.journalStore.listSessionSummaries();
    const journalIds = new Set(journalSummaries.map((summary) => summary.sessionId));
    const legacySummaries = this.legacyStore.listSessionSummaries()
      .filter((summary) => !journalIds.has(summary.sessionId));
    return [...journalSummaries, ...legacySummaries]
      .sort((left, right) => readSummaryActivityAt(right).localeCompare(readSummaryActivityAt(left)));
  };

  listSessions = async (): Promise<AgentSessionRecord[]> => {
    const summaries = await this.listSessionSummaries();
    const sessions: AgentSessionRecord[] = [];
    for (const summary of summaries) {
      const sessionId = summary.sessionId.trim();
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

  saveSession = async (sessionRecord: AgentSessionRecord): Promise<void> => {
    const journalSession = await this.journalStore.getSession(sessionRecord.sessionId);
    if (journalSession) {
      const updated = await this.journalStore.updateSessionMetadata({
        sessionId: sessionRecord.sessionId,
        metadata: {
          ...(journalSession.metadata ? structuredClone(journalSession.metadata) : {}),
          ...(sessionRecord.metadata ? structuredClone(sessionRecord.metadata) : {}),
        },
        updatedAt: sessionRecord.updatedAt,
      });
      if (updated) {
        this.options.onSessionUpdated?.(sessionRecord.sessionId);
      }
      return;
    }
    await this.legacyStore.saveSession(sessionRecord);
  };

  updateSessionMetadata = async (params: {
    sessionId: string;
    metadata: Record<string, unknown>;
    updatedAt: string;
  }): Promise<boolean> => {
    if (await this.journalStore.hasSession(params.sessionId)) {
      const updated = await this.journalStore.updateSessionMetadata(params);
      if (updated) {
        this.options.onSessionUpdated?.(params.sessionId);
      }
      return updated;
    }
    return this.legacyStore.updateSessionMetadata(params);
  };

  deleteSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const journalSession = await this.journalStore.deleteSession(sessionId);
    const legacySession = this.legacyStore.deleteSession(sessionId);
    if (journalSession && !legacySession) {
      this.options.onSessionUpdated?.(sessionId);
    }
    return journalSession ?? legacySession;
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

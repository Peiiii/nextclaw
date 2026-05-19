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
  appendSessionEvent?: AgentSessionStore["appendSessionEvent"];

  private readonly legacyStore: NcpAgentLegacySessionStore;

  constructor(
    sessionManager: SessionManager,
    private readonly options: {
      journalStore?: NcpAgentSessionJournalStore;
      onSessionUpdated?: (sessionKey: string) => void;
    } = {},
  ) {
    this.legacyStore = new NcpAgentLegacySessionStore(sessionManager, {
      onSessionUpdated: options.onSessionUpdated,
    });

    const journalStore = options.journalStore;
    if (journalStore) {
      this.appendSessionEvent = async (params: {
        session: AgentSessionEventRecord;
        event: NcpEndpointEvent;
        updatedAt: string;
      }): Promise<void> => {
        const { event, session } = params;
        if (!await journalStore.hasSession(session.sessionId)) {
          const legacySession = this.legacyStore.getSession(session.sessionId);
          if (legacySession) {
            await journalStore.materializeSession(legacySession);
          }
        }
        await journalStore.appendSessionEvent(params);
        if (isSessionSummaryRefreshEvent(event)) {
          this.options.onSessionUpdated?.(session.sessionId);
        }
      };
    }
  }

  getSession = async (sessionId: string): Promise<AgentSessionRecord | null> =>
    await this.options.journalStore?.getSession(sessionId) ?? this.legacyStore.getSession(sessionId);

  listSessionMessages = async (sessionId: string): Promise<NcpMessage[]> => {
    const journalStore = this.options.journalStore;
    return journalStore && await journalStore.hasSession(sessionId)
      ? await journalStore.listSessionMessages(sessionId)
      : this.legacyStore.listSessionMessages(sessionId);
  };

  listSessionSummaries = async (): Promise<NcpSessionSummary[]> => {
    const journalSummaries = await this.options.journalStore?.listSessionSummaries() ?? [];
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
    const journalStore = this.options.journalStore;
    if (journalStore && await journalStore.hasSession(sessionRecord.sessionId)) {
      await journalStore.materializeSession(sessionRecord);
      this.options.onSessionUpdated?.(sessionRecord.sessionId);
      return;
    }
    await this.legacyStore.saveSession(sessionRecord);
  };

  updateSessionMetadata = async (params: {
    sessionId: string;
    metadata: Record<string, unknown>;
    updatedAt: string;
  }): Promise<boolean> => {
    const journalStore = this.options.journalStore;
    if (journalStore && await journalStore.hasSession(params.sessionId)) {
      const updated = await journalStore.updateSessionMetadata(params);
      if (updated) {
        this.options.onSessionUpdated?.(params.sessionId);
      }
      return updated;
    }
    return this.legacyStore.updateSessionMetadata(params);
  };

  deleteSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const journalSession = await this.options.journalStore?.deleteSession(sessionId);
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

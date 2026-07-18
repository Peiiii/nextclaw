import { appendFile, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import type { NcpMessage, NcpSessionSummary } from "@nextclaw/ncp";
import {
  createNcpAgentSessionSummary,
  type LoadedNcpAgentJournalSession,
  NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
  NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE,
  type NcpAgentSessionJournalEventEntry,
  type NcpAgentSessionJournalReplayEvent,
  normalizeNcpSessionId,
  readNcpAgentSessionPeerId,
  replayNcpAgentSessionEvents,
  safeNcpSessionFilename
} from "@kernel/utils/ncp-agent-session-journal.utils.js";
import {
  isNcpAgentSessionMessageProjectionBoundaryEvent,
  parseNcpAgentSessionJournal,
  serializeNcpAgentSessionJournalEntry
} from "@kernel/utils/ncp-agent-session-journal-entry.utils.js";
import { NcpAgentSessionMetadataStore } from "./ncp-agent-session-metadata.store.js";
import { NcpAgentSessionMessageProjectionStore } from "./ncp-agent-session-message-projection.store.js";
import { NcpAgentSessionSummaryIndexStore } from "./ncp-agent-session-summary-index.store.js";
import type { SessionMessagePage } from "@kernel/types/session.types.js";

export class NcpAgentSessionJournalStore {
  private readonly sessions = new Map<string, LoadedNcpAgentJournalSession>();
  private readonly nextSeqBySession = new Map<string, number>();
  private readonly writeChains = new Map<string, Promise<void>>();
  private readonly metadataStore: NcpAgentSessionMetadataStore;
  private readonly messageProjectionStore: NcpAgentSessionMessageProjectionStore;
  private readonly summaryIndexStore: NcpAgentSessionSummaryIndexStore;

  constructor(private readonly journalDir: string) {
    this.metadataStore = new NcpAgentSessionMetadataStore(journalDir);
    this.messageProjectionStore = new NcpAgentSessionMessageProjectionStore(journalDir, {
      loadSession: async (sessionId) => {
        const loaded = this.sessions.get(sessionId) ?? (await this.loadSession(sessionId));
        if (loaded) {
          this.sessions.set(sessionId, loaded);
        }
        return loaded;
      }
    });
    this.summaryIndexStore = new NcpAgentSessionSummaryIndexStore(journalDir, async (sessionId) =>
      this.loadSession(sessionId)
    );
  }

  appendSessionEvent = async (params: {
    sessionId: string;
    event: NcpAgentSessionJournalReplayEvent;
  }): Promise<void> => {
    const sessionId = normalizeNcpSessionId(params.sessionId);
    if (!sessionId) {
      return;
    }
    const previous = this.writeChains.get(sessionId) ?? Promise.resolve();
    const next = previous.then(() =>
      this.appendSessionEventNow({
        ...params,
        sessionId
      })
    );
    this.writeChains.set(
      sessionId,
      next.catch(() => undefined)
    );
    await next;
  };

  getSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const normalizedSessionId = normalizeNcpSessionId(sessionId);
    if (!normalizedSessionId) {
      return null;
    }
    const cached = this.sessions.get(normalizedSessionId);
    if (cached) {
      return structuredClone(cached.record);
    }
    const loaded = await this.loadSession(normalizedSessionId);
    if (!loaded) {
      return null;
    }
    this.sessions.set(normalizedSessionId, loaded);
    return structuredClone(loaded.record);
  };

  listSessionSummaries = async (): Promise<NcpSessionSummary[]> => {
    const summaries = await this.summaryIndexStore.list();
    return await Promise.all(summaries.map(this.withMetadata));
  };

  listSessionMessages = async (sessionId: string): Promise<NcpMessage[]> => {
    const session = await this.getSession(sessionId);
    return session ? session.messages.map((message) => structuredClone(message)) : [];
  };

  listSessionMessagePage = async (params: {
    sessionId: string;
    limit: number;
    cursor?: string;
  }): Promise<SessionMessagePage | null> => {
    const sessionId = normalizeNcpSessionId(params.sessionId);
    if (!sessionId) {
      return null;
    }
    return await this.messageProjectionStore.listPage({
      sessionId,
      limit: params.limit,
      cursor: params.cursor
    });
  };

  updateSessionMessageProjectionContextWindow = async (
    sessionId: string,
    contextWindow: Record<string, unknown> | null
  ): Promise<void> => {
    const normalizedSessionId = normalizeNcpSessionId(sessionId);
    if (!normalizedSessionId) {
      return;
    }
    await this.messageProjectionStore.updateContextWindow(normalizedSessionId, contextWindow);
  };

  setSessionMetadata = async (params: { sessionId: string; metadata: Record<string, unknown> }): Promise<boolean> => {
    const sessionId = normalizeNcpSessionId(params.sessionId);
    if (!sessionId) {
      return false;
    }
    const previous = this.writeChains.get(sessionId) ?? Promise.resolve();
    const next = previous.then(() =>
      this.setSessionMetadataNow({
        ...params,
        sessionId
      })
    );
    this.writeChains.set(
      sessionId,
      next.then(
        () => undefined,
        () => undefined
      )
    );
    return await next;
  };

  updateSessionMetadata = async (params: {
    sessionId: string;
    metadata: Record<string, unknown>;
  }): Promise<boolean> => {
    const sessionId = normalizeNcpSessionId(params.sessionId);
    if (!sessionId) {
      return false;
    }
    const previous = this.writeChains.get(sessionId) ?? Promise.resolve();
    const next = previous.then(() =>
      this.updateSessionMetadataNow({
        ...params,
        sessionId
      })
    );
    this.writeChains.set(
      sessionId,
      next.then(
        () => undefined,
        () => undefined
      )
    );
    return await next;
  };

  private setSessionMetadataNow = async (params: {
    sessionId: string;
    metadata: Record<string, unknown>;
  }): Promise<boolean> => {
    const { metadata, sessionId } = params;
    const loaded = this.sessions.get(sessionId) ?? (await this.loadSession(sessionId));
    if (!loaded) {
      return false;
    }
    const nextRecord: AgentSessionRecord = {
      ...loaded.record,
      metadata: structuredClone(metadata)
    };
    await this.metadataStore.write(nextRecord);
    this.sessions.set(sessionId, {
      record: nextRecord,
      nextSeq: loaded.nextSeq,
      projectedJournalOffset: loaded.projectedJournalOffset
    });
    this.nextSeqBySession.set(sessionId, loaded.nextSeq);
    await this.summaryIndexStore.upsert(createNcpAgentSessionSummary(nextRecord));
    return true;
  };

  private updateSessionMetadataNow = async (params: {
    sessionId: string;
    metadata: Record<string, unknown>;
  }): Promise<boolean> => {
    const loaded = this.sessions.get(params.sessionId) ?? (await this.loadSession(params.sessionId));
    if (!loaded) {
      return false;
    }
    return await this.setSessionMetadataNow({
      ...params,
      metadata: {
        ...(loaded.record.metadata ? structuredClone(loaded.record.metadata) : {}),
        ...structuredClone(params.metadata)
      }
    });
  };

  importSessionSnapshot = async (record: AgentSessionRecord): Promise<void> => {
    const sessionId = normalizeNcpSessionId(record.sessionId);
    if (!sessionId) {
      return;
    }
    await this.ensureJournalDir();
    const nextRecord = structuredClone({ ...record, sessionId });
    await this.metadataStore.write(nextRecord);
    const entries = nextRecord.messages.map(
      (message, index): NcpAgentSessionJournalEventEntry => ({
        _type: "event",
        version: NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
        seq: index + 1,
        timestamp: message.timestamp ?? nextRecord.updatedAt,
        event: {
          type: NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE,
          payload: {
            sessionId,
            message: structuredClone(message)
          }
        }
      })
    );
    await writeFile(
      this.sessionPath(sessionId),
      entries.length > 0 ? `${entries.map(serializeNcpAgentSessionJournalEntry).join("\n")}\n` : "",
      "utf-8"
    );
    const nextSeq = nextRecord.messages.length + 1;
    const journalStat = await stat(this.sessionPath(sessionId));
    this.sessions.set(sessionId, {
      record: nextRecord,
      nextSeq,
      projectedJournalOffset: journalStat.size
    });
    this.nextSeqBySession.set(sessionId, nextSeq);
    await this.messageProjectionStore.rebuild({
      sessionId,
      messages: nextRecord.messages,
      projectedJournalOffset: journalStat.size
    });
    await this.summaryIndexStore.upsert(createNcpAgentSessionSummary(nextRecord));
  };

  deleteSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const normalizedSessionId = normalizeNcpSessionId(sessionId);
    if (!normalizedSessionId) {
      return null;
    }
    const existing = await this.getSession(normalizedSessionId);
    this.sessions.delete(normalizedSessionId);
    this.nextSeqBySession.delete(normalizedSessionId);
    try {
      await unlink(this.sessionPath(normalizedSessionId));
    } catch {
      // The journal may already be absent when deleting a legacy-only session.
    }
    await this.metadataStore.delete(normalizedSessionId);
    await this.messageProjectionStore.delete(normalizedSessionId);
    await this.summaryIndexStore.remove(normalizedSessionId);
    return existing;
  };

  hasSession = async (sessionId: string): Promise<boolean> => {
    const normalizedSessionId = normalizeNcpSessionId(sessionId);
    if (!normalizedSessionId) {
      return false;
    }
    return this.summaryIndexStore.has(normalizedSessionId);
  };

  private appendSessionEventNow = async (params: {
    sessionId: string;
    event: NcpAgentSessionJournalReplayEvent;
  }): Promise<void> => {
    const { event, sessionId } = params;
    const updatedAt = new Date().toISOString();
    await this.ensureJournalDir();
    const existing =
      this.sessions.get(sessionId) ?? (this.nextSeqBySession.has(sessionId) ? null : await this.loadSession(sessionId));
    const nextSeq = this.nextSeqBySession.get(sessionId) ?? existing?.nextSeq ?? 1;
    const path = this.sessionPath(sessionId);
    const entry: NcpAgentSessionJournalEventEntry = {
      _type: "event",
      version: NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
      seq: nextSeq,
      timestamp: updatedAt,
      event: structuredClone(event)
    };
    await this.appendJournalEntry(path, entry);
    this.nextSeqBySession.set(sessionId, nextSeq + 1);
    this.sessions.delete(sessionId);
    if (isNcpAgentSessionMessageProjectionBoundaryEvent(event)) {
      const journalStat = await stat(path);
      const projectionMeta = await this.messageProjectionStore.readMeta(sessionId);
      if (projectionMeta) {
        const projectionTail = await this.messageProjectionStore.readJournalTailMessages(
          sessionId,
          projectionMeta.projectedJournalOffset
        );
        await this.messageProjectionStore.synchronize({
          sessionId,
          messages: projectionTail,
          projectedJournalOffset: journalStat.size
        });
      }
    }
    await this.summaryIndexStore.upsertForEvent({
      sessionId,
      event,
      updatedAt
    });
  };

  private withMetadata = async (summary: NcpSessionSummary): Promise<NcpSessionSummary> => {
    const snapshot = await this.metadataStore.read(summary.sessionId, {
      ...(summary.agentId ? { agentId: summary.agentId } : {}),
      createdAt: summary.createdAt ?? summary.updatedAt,
      updatedAt: summary.updatedAt,
      metadata: {}
    });
    const peerId = summary.peerId ?? readNcpAgentSessionPeerId(snapshot.metadata);
    return {
      ...summary,
      peerId: peerId ?? undefined,
      ...(!summary.agentId && snapshot.agentId ? { agentId: snapshot.agentId } : {}),
      ...(Object.keys(snapshot.metadata).length > 0 ? { metadata: snapshot.metadata } : {})
    };
  };

  private loadSession = async (sessionId: string): Promise<LoadedNcpAgentJournalSession | null> => {
    let raw: string;
    try {
      raw = await readFile(this.sessionPath(sessionId), "utf-8");
    } catch {
      return null;
    }

    const parsedJournal = parseNcpAgentSessionJournal(raw);
    const sessionMetadata = await this.metadataStore.read(sessionId, parsedJournal);
    const { agentId, createdAt, updatedAt, metadata } = sessionMetadata;
    const { events, nextSeq, projectedJournalOffset } = parsedJournal;
    const messages = await replayNcpAgentSessionEvents(events);
    const record: AgentSessionRecord = {
      sessionId,
      ...(agentId ? { agentId } : {}),
      messages,
      createdAt,
      updatedAt,
      metadata
    };
    this.nextSeqBySession.set(sessionId, nextSeq);
    return {
      record,
      nextSeq,
      projectedJournalOffset
    };
  };

  private appendJournalEntry = async (path: string, entry: NcpAgentSessionJournalEventEntry): Promise<void> => {
    await appendFile(path, `${serializeNcpAgentSessionJournalEntry(entry)}\n`, "utf-8");
  };

  private ensureJournalDir = async (): Promise<void> => {
    await mkdir(this.journalDir, { recursive: true });
  };

  private sessionPath = (sessionId: string): string => {
    return join(this.journalDir, `${safeNcpSessionFilename(sessionId.replace(/:/g, "_"))}.jsonl`);
  };
}

import { appendFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentSessionEventRecord, AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import type { NcpMessage, NcpSessionSummary } from "@nextclaw/ncp";
import {
  createNcpAgentSessionSummary,
  isRecord,
  type LoadedNcpAgentJournalSession,
  NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
  NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE,
  type NcpAgentSessionJournalEventEntry,
  type NcpAgentSessionJournalReplayEvent,
  normalizeNcpAgentId,
  normalizeNcpSessionId,
  replayNcpAgentSessionEvents,
  safeNcpSessionFilename,
  toIsoString,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { NcpAgentSessionMetadataStore } from "./ncp-agent-session-metadata.store.js";
import { NcpAgentSessionSummaryIndexStore } from "./ncp-agent-session-summary-index.store.js";

type ParsedNcpAgentSessionJournal = {
  metadata: Record<string, unknown>;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
  nextSeq: number;
  events: NcpAgentSessionJournalReplayEvent[];
};

function serializeJournalEntry(entry: NcpAgentSessionJournalEventEntry): string {
  const serialized = JSON.stringify(entry);
  if (!serialized) {
    throw new Error("ncp agent session journal entry serialization produced empty output");
  }
  const parsed = JSON.parse(serialized) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("ncp agent session journal entry serialization produced a non-object entry");
  }
  return serialized;
}

export class NcpAgentSessionJournalStore {
  private readonly sessions = new Map<string, LoadedNcpAgentJournalSession>();
  private readonly nextSeqBySession = new Map<string, number>();
  private readonly writeChains = new Map<string, Promise<void>>();
  private readonly metadataStore: NcpAgentSessionMetadataStore;
  private readonly summaryIndexStore: NcpAgentSessionSummaryIndexStore;

  constructor(private readonly journalDir: string) {
    this.metadataStore = new NcpAgentSessionMetadataStore(journalDir);
    this.summaryIndexStore = new NcpAgentSessionSummaryIndexStore(
      journalDir,
      async (sessionId) => this.loadSession(sessionId),
    );
  }

  appendSessionEvent = async (params: {
    session: AgentSessionEventRecord;
    event: NcpAgentSessionJournalReplayEvent;
    updatedAt: string;
  }): Promise<void> => {
    const sessionId = normalizeNcpSessionId(params.session.sessionId);
    if (!sessionId) {
      return;
    }
    const previous = this.writeChains.get(sessionId) ?? Promise.resolve();
    const next = previous.then(() => this.appendSessionEventNow({
      ...params,
      session: {
        ...params.session,
        sessionId,
      },
    }));
    this.writeChains.set(sessionId, next.catch(() => undefined));
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
    return this.summaryIndexStore.list();
  };

  listSessionMessages = async (sessionId: string): Promise<NcpMessage[]> => {
    const session = await this.getSession(sessionId);
    return session ? session.messages.map((message) => structuredClone(message)) : [];
  };

  setSessionMetadata = async (params: {
    sessionId: string;
    metadata: Record<string, unknown>;
    updatedAt: string;
  }): Promise<boolean> => {
    const sessionId = normalizeNcpSessionId(params.sessionId);
    if (!sessionId) {
      return false;
    }
    const previous = this.writeChains.get(sessionId) ?? Promise.resolve();
    const next = previous.then(() => this.setSessionMetadataNow({
      ...params,
      sessionId,
    }));
    this.writeChains.set(sessionId, next.then(() => undefined, () => undefined));
    return await next;
  };

  updateSessionMetadata = async (params: {
    sessionId: string;
    metadata: Record<string, unknown>;
    updatedAt: string;
  }): Promise<boolean> => {
    const sessionId = normalizeNcpSessionId(params.sessionId);
    if (!sessionId) {
      return false;
    }
    const previous = this.writeChains.get(sessionId) ?? Promise.resolve();
    const next = previous.then(() => this.updateSessionMetadataNow({
      ...params,
      sessionId,
    }));
    this.writeChains.set(sessionId, next.then(() => undefined, () => undefined));
    return await next;
  };

  private setSessionMetadataNow = async (params: {
    sessionId: string;
    metadata: Record<string, unknown>;
    updatedAt: string;
  }): Promise<boolean> => {
    const { metadata, sessionId, updatedAt } = params;
    const loaded = this.sessions.get(sessionId) ?? await this.loadSession(sessionId);
    if (!loaded) {
      return false;
    }
    const nextRecord: AgentSessionRecord = {
      ...loaded.record,
      metadata: structuredClone(metadata),
      updatedAt,
    };
    await this.metadataStore.write(nextRecord);
    this.sessions.set(sessionId, {
      record: nextRecord,
      nextSeq: loaded.nextSeq,
    });
    this.nextSeqBySession.set(sessionId, loaded.nextSeq);
    await this.summaryIndexStore.upsert(createNcpAgentSessionSummary(nextRecord));
    return true;
  };

  private updateSessionMetadataNow = async (params: {
    sessionId: string;
    metadata: Record<string, unknown>;
    updatedAt: string;
  }): Promise<boolean> => {
    const loaded = this.sessions.get(params.sessionId) ?? await this.loadSession(params.sessionId);
    if (!loaded) {
      return false;
    }
    return await this.setSessionMetadataNow({
      ...params,
      metadata: {
        ...(loaded.record.metadata ? structuredClone(loaded.record.metadata) : {}),
        ...structuredClone(params.metadata),
      },
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
    const entries = nextRecord.messages.map((message, index): NcpAgentSessionJournalEventEntry => ({
      _type: "event",
      version: NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
      seq: index + 1,
      timestamp: message.timestamp ?? nextRecord.updatedAt,
      event: {
        type: NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE,
        payload: {
          sessionId,
          message: structuredClone(message),
        },
      },
    }));
    await writeFile(
      this.sessionPath(sessionId),
      entries.length > 0 ? `${entries.map(serializeJournalEntry).join("\n")}\n` : "",
      "utf-8",
    );
    const nextSeq = nextRecord.messages.length + 1;
    this.sessions.set(sessionId, {
      record: nextRecord,
      nextSeq,
    });
    this.nextSeqBySession.set(sessionId, nextSeq);
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
    session: AgentSessionEventRecord;
    event: NcpAgentSessionJournalReplayEvent;
    updatedAt: string;
  }): Promise<void> => {
    const { event, session, updatedAt } = params;
    const { sessionId } = session;
    await this.ensureJournalDir();
    const existing = this.sessions.get(sessionId)
      ?? (this.nextSeqBySession.has(sessionId) ? null : await this.loadSession(sessionId));
    const nextSeq = this.nextSeqBySession.get(sessionId) ?? existing?.nextSeq ?? 1;
    const path = this.sessionPath(sessionId);
    await this.metadataStore.write({
      ...session,
      ...(existing?.record.createdAt ? { createdAt: existing.record.createdAt } : {}),
      updatedAt,
      metadata: {
        ...(existing?.record.metadata ? structuredClone(existing.record.metadata) : {}),
        ...(session.metadata ? structuredClone(session.metadata) : {}),
      },
    });
    const entry: NcpAgentSessionJournalEventEntry = {
      _type: "event",
      version: NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
      seq: nextSeq,
      timestamp: updatedAt,
      event: structuredClone(event),
    };
    await this.appendJournalEntry(path, entry);
    this.nextSeqBySession.set(sessionId, nextSeq + 1);
    this.sessions.delete(sessionId);
    await this.summaryIndexStore.upsertForEvent({
      session,
      event,
      updatedAt,
    });
  };

  private loadSession = async (sessionId: string): Promise<LoadedNcpAgentJournalSession | null> => {
    let raw: string;
    try {
      raw = await readFile(this.sessionPath(sessionId), "utf-8");
    } catch {
      return null;
    }

    const parsedJournal = this.parseSessionJournal(raw);
    const sessionMetadata = await this.metadataStore.read(sessionId, parsedJournal);
    const { agentId, createdAt, updatedAt, metadata } = sessionMetadata;
    const { events, nextSeq } = parsedJournal;
    const messages = await replayNcpAgentSessionEvents(events);
    const record: AgentSessionRecord = {
      sessionId,
      ...(agentId ? { agentId } : {}),
      messages,
      createdAt,
      updatedAt,
      metadata,
    };
    this.nextSeqBySession.set(sessionId, nextSeq);
    return {
      record,
      nextSeq,
    };
  };

  private parseSessionJournal = (raw: string): ParsedNcpAgentSessionJournal => {
    let metadata: Record<string, unknown> = {};
    let agentId: string | undefined;
    let createdAt = new Date().toISOString();
    let updatedAt = createdAt;
    let nextSeq = 1;
    const events: NcpAgentSessionJournalReplayEvent[] = [];
    for (const [index, line] of raw.split("\n").entries()) {
      if (!line.trim()) {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(line) as unknown;
      } catch (error) {
        console.warn(
          `[ncp-agent-session-journal] skipped corrupted journal line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`
        );
        continue;
      }
      if (!isRecord(parsed)) {
        continue;
      }
      if (parsed._type === "metadata") {
        metadata = isRecord(parsed.metadata) ? structuredClone(parsed.metadata) : {};
        agentId = normalizeNcpAgentId(typeof parsed.agent_id === "string" ? parsed.agent_id : undefined);
        createdAt = toIsoString(parsed.created_at, createdAt);
        updatedAt = toIsoString(parsed.updated_at, updatedAt);
        continue;
      }
      if (parsed._type === "event" && isRecord(parsed.event)) {
        const seq = Number(parsed.seq);
        nextSeq = Math.max(nextSeq, Number.isFinite(seq) ? Math.trunc(seq) + 1 : nextSeq);
        updatedAt = toIsoString(parsed.timestamp, updatedAt);
        const event = structuredClone(parsed.event) as NcpAgentSessionJournalReplayEvent;
        events.push(event);
      }
    }
    return { metadata, ...(agentId ? { agentId } : {}), createdAt, updatedAt, nextSeq, events };
  };

  private appendJournalEntry = async (
    path: string,
    entry: NcpAgentSessionJournalEventEntry,
  ): Promise<void> => {
    await appendFile(path, `${serializeJournalEntry(entry)}\n`, "utf-8");
  };

  private ensureJournalDir = async (): Promise<void> => {
    await mkdir(this.journalDir, { recursive: true });
  };

  private sessionPath = (sessionId: string): string => {
    return join(this.journalDir, `${safeNcpSessionFilename(sessionId.replace(/:/g, "_"))}.jsonl`);
  };
}

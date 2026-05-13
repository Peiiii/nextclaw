import { appendFile, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { AgentSessionEventRecord, AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import {
  type NcpEndpointEvent,
  type NcpMessage,
  type NcpSessionSummary,
  NcpEventType,
} from "@nextclaw/ncp";
import {
  createNcpAgentSessionJournalMetadataEntry,
  createNcpAgentSessionSummary,
  isRecord,
  type LoadedNcpAgentJournalSession,
  NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
  NCP_AGENT_SESSION_JOURNAL_INDEX_FILE,
  type NcpAgentSessionJournalEventEntry,
  type NcpAgentSessionJournalIndex,
  normalizeNcpAgentId,
  normalizeNcpSessionId,
  readNcpSessionSummaryActivityAt,
  replayNcpAgentSessionEvents,
  safeNcpSessionFilename,
  toIsoString,
  upsertNcpAgentSessionSummaryEvent,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";

type ParsedNcpAgentSessionJournal = {
  metadata: Record<string, unknown>;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
  nextSeq: number;
  events: NcpEndpointEvent[];
};

export class NcpAgentSessionJournalStore {
  private readonly sessions = new Map<string, LoadedNcpAgentJournalSession>();
  private readonly nextSeqBySession = new Map<string, number>();
  private readonly writeChains = new Map<string, Promise<void>>();
  private summaryIndex: Map<string, NcpSessionSummary> | null = null;

  constructor(private readonly journalDir: string) {}

  appendSessionEvent = async (params: {
    session: AgentSessionEventRecord;
    event: NcpEndpointEvent;
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

  getSessionSummary = async (sessionId: string): Promise<NcpSessionSummary | null> => {
    const normalizedSessionId = normalizeNcpSessionId(sessionId);
    if (!normalizedSessionId) {
      return null;
    }
    const index = await this.loadSummaryIndex();
    const indexed = index.get(normalizedSessionId);
    if (indexed) {
      return structuredClone(indexed);
    }
    const record = await this.getSession(normalizedSessionId);
    return record ? createNcpAgentSessionSummary(record) : null;
  };

  listSessionSummaries = async (): Promise<NcpSessionSummary[]> => {
    const index = await this.loadSummaryIndex();
    return [...index.values()]
      .map((summary) => structuredClone(summary))
      .sort((left, right) => readNcpSessionSummaryActivityAt(right).localeCompare(readNcpSessionSummaryActivityAt(left)));
  };

  listSessionMessages = async (sessionId: string): Promise<NcpMessage[]> => {
    const session = await this.getSession(sessionId);
    return session ? session.messages.map((message) => structuredClone(message)) : [];
  };

  replaceSession = async (record: AgentSessionRecord): Promise<void> => {
    const sessionId = normalizeNcpSessionId(record.sessionId);
    if (!sessionId) {
      return;
    }
    await this.ensureJournalDir();
    const nextRecord = structuredClone({ ...record, sessionId });
    const entries = [
      createNcpAgentSessionJournalMetadataEntry(nextRecord),
      ...nextRecord.messages.map((message, index): NcpAgentSessionJournalEventEntry => ({
        _type: "event",
        version: NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
        seq: index + 1,
        timestamp: message.timestamp ?? nextRecord.updatedAt,
        event: {
          type: NcpEventType.MessageSent,
          payload: {
            sessionId,
            message: structuredClone(message),
          },
        },
      })),
    ];
    await writeFile(
      this.sessionPath(sessionId),
      `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
      "utf-8",
    );
    const nextSeq = nextRecord.messages.length + 1;
    this.sessions.set(sessionId, {
      record: nextRecord,
      nextSeq,
    });
    this.nextSeqBySession.set(sessionId, nextSeq);
    await this.upsertSummaryIndex(createNcpAgentSessionSummary(nextRecord));
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
    await this.removeSummaryIndex(normalizedSessionId);
    return existing;
  };

  hasSession = async (sessionId: string): Promise<boolean> => {
    const normalizedSessionId = normalizeNcpSessionId(sessionId);
    if (!normalizedSessionId) {
      return false;
    }
    return (await this.loadSummaryIndex()).has(normalizedSessionId);
  };

  private appendSessionEventNow = async (params: {
    session: AgentSessionEventRecord;
    event: NcpEndpointEvent;
    updatedAt: string;
  }): Promise<void> => {
    const { event, session, updatedAt } = params;
    const { sessionId } = session;
    await this.ensureJournalDir();
    const existing = this.sessions.get(sessionId)
      ?? (this.nextSeqBySession.has(sessionId) ? null : await this.loadSession(sessionId));
    const hasJournal = Boolean(existing) || this.nextSeqBySession.has(sessionId);
    const nextSeq = this.nextSeqBySession.get(sessionId) ?? existing?.nextSeq ?? 1;
    const path = this.sessionPath(sessionId);
    if (!hasJournal) {
      await appendFile(path, `${JSON.stringify(createNcpAgentSessionJournalMetadataEntry(session))}\n`, "utf-8");
    }
    const entry: NcpAgentSessionJournalEventEntry = {
      _type: "event",
      version: NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
      seq: nextSeq,
      timestamp: updatedAt,
      event: structuredClone(event),
    };
    await appendFile(path, `${JSON.stringify(entry)}\n`, "utf-8");
    this.nextSeqBySession.set(sessionId, nextSeq + 1);
    this.sessions.delete(sessionId);
    await this.upsertSummaryIndexForEvent({
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
    const { agentId, createdAt, events, metadata, nextSeq, updatedAt } = parsedJournal;
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
    const events: NcpEndpointEvent[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) {
        continue;
      }
      const parsed = JSON.parse(line) as unknown;
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
        events.push(structuredClone(parsed.event) as NcpEndpointEvent);
      }
    }
    return { metadata, ...(agentId ? { agentId } : {}), createdAt, updatedAt, nextSeq, events };
  };

  private loadSummaryIndex = async (): Promise<Map<string, NcpSessionSummary>> => {
    if (this.summaryIndex) {
      return this.summaryIndex;
    }
    try {
      const parsed = JSON.parse(await readFile(this.indexPath(), "utf-8")) as NcpAgentSessionJournalIndex;
      if (parsed.version === NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION && Array.isArray(parsed.records)) {
        this.summaryIndex = new Map(
          parsed.records.map((record) => [record.sessionId, structuredClone(record)]),
        );
        return this.summaryIndex;
      }
    } catch {
      // Rebuild below.
    }
    this.summaryIndex = await this.rebuildSummaryIndex();
    await this.persistSummaryIndex();
    return this.summaryIndex;
  };

  private rebuildSummaryIndex = async (): Promise<Map<string, NcpSessionSummary>> => {
    const records = new Map<string, NcpSessionSummary>();
    let entries: string[] = [];
    try {
      entries = await readdir(this.journalDir);
    } catch {
      return records;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) {
        continue;
      }
      const sessionId = entry.replace(/\.jsonl$/, "").replace(/_/g, ":");
      const loaded = await this.loadSession(sessionId);
      if (!loaded) {
        continue;
      }
      this.sessions.set(sessionId, loaded);
      records.set(sessionId, createNcpAgentSessionSummary(loaded.record));
    }
    return records;
  };

  private upsertSummaryIndex = async (summary: NcpSessionSummary): Promise<void> => {
    const index = await this.loadSummaryIndex();
    index.set(summary.sessionId, structuredClone(summary));
    await this.persistSummaryIndex();
  };

  private upsertSummaryIndexForEvent = async (params: {
    session: AgentSessionEventRecord;
    event: NcpEndpointEvent;
    updatedAt: string;
  }): Promise<void> => {
    const { event, session, updatedAt } = params;
    const index = await this.loadSummaryIndex();
    const summary = upsertNcpAgentSessionSummaryEvent({
      current: index.get(session.sessionId),
      session,
      event,
      updatedAt,
    });
    index.set(summary.sessionId, summary);
    await this.persistSummaryIndex();
  };

  private removeSummaryIndex = async (sessionId: string): Promise<void> => {
    const index = await this.loadSummaryIndex();
    index.delete(sessionId);
    await this.persistSummaryIndex();
  };

  private persistSummaryIndex = async (): Promise<void> => {
    const records = [...(this.summaryIndex?.values() ?? [])]
      .map((summary) => structuredClone(summary))
      .sort((left, right) => readNcpSessionSummaryActivityAt(right).localeCompare(readNcpSessionSummaryActivityAt(left)));
    await this.ensureJournalDir();
    await writeFile(
      this.indexPath(),
      `${JSON.stringify({ version: NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION, records })}\n`,
      "utf-8",
    );
  };

  private ensureJournalDir = async (): Promise<void> => {
    await mkdir(this.journalDir, { recursive: true });
  };

  private sessionPath = (sessionId: string): string => {
    return join(this.journalDir, `${safeNcpSessionFilename(sessionId.replace(/:/g, "_"))}.jsonl`);
  };

  private indexPath = (): string => resolve(this.journalDir, NCP_AGENT_SESSION_JOURNAL_INDEX_FILE);
}

import { SessionEventReplayer, createNcpAgentSessionSummary, applyNcpAgentRunLifecycleEvent,
  SessionMessageCursorError, type SessionPersistence, type NcpAgentSessionJournalReplayEvent,
  type UnfinishedNcpAgentRun } from "@nextclaw/kernel";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { NcpEventType, type NcpSessionSummary } from "@nextclaw/ncp";
import { BiboEdgeSessionStore } from "./bibo-edge-session.store";
import { applyBiboStorageChanges } from "../utils/bibo-storage.utils";

type Head = Omit<AgentSessionRecord, "messages"> & {
  sequence: number;
  activeRun: UnfinishedNcpAgentRun | null;
  summary?: NcpSessionSummary;
};
type Loaded = { head: Head; replay: SessionEventReplayer };
const headKey = (id: string) => `sessionHead:${id}`;
const tailPrefix = (id: string) => `sessionTail:${id}:`;
const eventKey = (id: string, sequence: number) => `${tailPrefix(id)}${String(sequence).padStart(16, "0")}`;
const CHUNK_LENGTH = 200_000;

/** Durable storage only: session semantics and event replay remain owned by Kernel. */
export class CloudflareSessionStore implements SessionPersistence {
  private readonly snapshots: BiboEdgeSessionStore;
  private readonly loaded = new Map<string, Loaded>();
  private readonly writes = new Map<string, Promise<unknown>>();

  constructor(private readonly storage: DurableObjectStorage) {
    this.snapshots = new BiboEdgeSessionStore(storage);
  }

  private write = <T>(id: string, operation: () => Promise<T>): Promise<T> => {
    const result = (this.writes.get(id) ?? Promise.resolve()).then(operation);
    const settled = result.catch(() => { this.loaded.delete(id); });
    this.writes.set(id, settled);
    void settled.then(() => { if (this.writes.get(id) === settled) this.writes.delete(id); });
    return result;
  };

  private load = async (id: string): Promise<Loaded | null> => {
    const cached = this.loaded.get(id);
    if (cached) return cached;
    const { snapshot, storedHead, tail } = await this.storage.transaction(async (transaction) => ({
      snapshot: await new BiboEdgeSessionStore(transaction as unknown as DurableObjectStorage).load(id),
      storedHead: await transaction.get<Head>(headKey(id)),
      tail: await transaction.list<string>({ prefix: tailPrefix(id) }),
    }));
    let head = storedHead;
    if (!head && !snapshot) return null;
    head ??= { sessionId: id, agentId: "main", metadata: snapshot?.metadata ?? {}, sequence: 0,
      activeRun: null, createdAt: snapshot?.messages[0]?.timestamp,
      updatedAt: snapshot?.messages.at(-1)?.timestamp ?? new Date().toISOString() };
    const replay = await SessionEventReplayer.create(snapshot?.messages ?? []);
    // Keys sort by event sequence, then chunk ordinal. Chunk values stay below DO limits.
    let current = "";
    let chunks: string[] = [];
    const append = async () => {
      if (current) await replay.append(JSON.parse(chunks.join("")) as NcpAgentSessionJournalReplayEvent,
        Number(current.slice(tailPrefix(id).length)), new Set());
    };
    for (const [key, value] of tail) {
      const base = key.slice(0, key.lastIndexOf(":"));
      if (base !== current) { await append(); current = base; chunks = []; }
      chunks.push(value);
    }
    await append();
    const loaded = { head, replay };
    this.loaded.set(id, loaded);
    return loaded;
  };

  appendSessionEvent: SessionPersistence["appendSessionEvent"] = ({ sessionId, event }) => this.write(sessionId, async () => {
    const loaded = await this.load(sessionId);
    if (!loaded) throw new Error(`Session not found: ${sessionId}`);
    const head = { ...loaded.head, sequence: loaded.head.sequence + 1, updatedAt: new Date().toISOString(),
      activeRun: applyNcpAgentRunLifecycleEvent(sessionId, loaded.head.activeRun, event) };
    const encoded = JSON.stringify(event);
    const entries: Record<string, unknown> = { [headKey(sessionId)]: head };
    for (let offset = 0; offset < encoded.length; offset += CHUNK_LENGTH) {
      entries[`${eventKey(sessionId, head.sequence)}:${String(offset / CHUNK_LENGTH).padStart(8, "0")}`] = encoded.slice(offset, offset + CHUNK_LENGTH);
    }
    await loaded.replay.append(event, head.sequence, new Set());
    if ([NcpEventType.MessageSent, NcpEventType.MessageCompleted, NcpEventType.RunFinished, NcpEventType.RunError].includes(event.type as NcpEventType)) {
      head.summary = createNcpAgentSessionSummary({ ...head, messages: loaded.replay.finish() });
    }
    await this.storage.transaction(async (transaction) => applyBiboStorageChanges(transaction, entries));
    loaded.head = head;
  });

  importSessionSnapshot: SessionPersistence["importSessionSnapshot"] = (record) => this.write(record.sessionId, async () => {
    const id = record.sessionId;
    const previous = await this.snapshots.load(id);
    const changes = this.snapshots.prepareCommit(id, previous, { version: 1, messages: record.messages, metadata: record.metadata ?? {} });
    const tail = await this.storage.list({ prefix: tailPrefix(id) });
    const { messages: _messages, ...fields } = record;
    const head: Head = { ...fields, sequence: 0, activeRun: null, summary: createNcpAgentSessionSummary(record) };
    await this.storage.transaction(async (transaction) => applyBiboStorageChanges(transaction,
      { ...changes.entries, [headKey(id)]: head }, [...changes.deletes, ...tail.keys()]));
    this.loaded.set(id, { head, replay: await SessionEventReplayer.create(record.messages) });
  });

  getSession: SessionPersistence["getSession"] = async (id) => {
    await this.writes.get(id);
    const loaded = await this.load(id);
    if (!loaded) return null;
    const { sequence: _sequence, activeRun: _run, summary: _summary, ...record } = loaded.head;
    return structuredClone({ ...record, messages: loaded.replay.finish() });
  };

  deleteSession: SessionPersistence["deleteSession"] = async (id) => {
    const record = await this.getSession(id);
    return this.write(id, async () => {
      const keys = await this.prepareDelete(id);
      await this.storage.transaction(async (transaction) => applyBiboStorageChanges(transaction, {},
        keys));
      this.loaded.delete(id);
      return record;
    });
  };

  prepareDelete = async (id: string): Promise<string[]> => {
    const previous = await this.snapshots.load(id);
    const tail = await this.storage.list({ prefix: tailPrefix(id) });
    return [...this.snapshots.prepareDelete(id, previous), headKey(id), `sessionContext:${id}`, ...tail.keys()];
  };

  getSessionSummary: SessionPersistence["getSessionSummary"] = async (id) => {
    await this.writes.get(id);
    const head = this.loaded.get(id)?.head ?? await this.storage.get<Head>(headKey(id));
    if (head?.summary) return this.projectSummary(head);
    const record = await this.getSession(id);
    return record ? createNcpAgentSessionSummary(record) : null;
  };

  listSessionSummaries: SessionPersistence["listSessionSummaries"] = async (options) => {
    const [heads, snapshots] = await Promise.all([
      this.storage.list<Head>({ prefix: "sessionHead:" }), this.storage.list({ prefix: "ncpSession:" }),
    ]);
    const ids = new Set([...heads.keys()].map((key) => key.slice("sessionHead:".length)));
    for (const key of snapshots.keys()) ids.add(key.slice("ncpSession:".length));
    const summaries = (await Promise.all([...ids].map((id) => {
      const head = heads.get(headKey(id));
      return head?.summary ? this.projectSummary(head) : this.getSessionSummary(id);
    }))).filter((value) => value !== null);
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return options?.limit === undefined ? summaries : summaries.slice(0, options.limit);
  };

  private projectSummary = (head: Head): NcpSessionSummary => structuredClone({
    ...head.summary!, metadata: head.metadata, updatedAt: head.updatedAt,
    status: head.activeRun ? "running" : "idle",
  });

  listSessionSummaryPage: SessionPersistence["listSessionSummaryPage"] = async ({ page, pageSize, query }) => {
    const normalized = query?.trim().toLowerCase();
    const sessions = (await this.listSessionSummaries()).filter((session) => !normalized ||
      `${session.sessionId} ${session.metadata?.label ?? ""}`.toLowerCase().includes(normalized));
    const size = Math.max(1, Math.floor(pageSize));
    const start = Math.max(0, Math.floor(page) - 1) * size;
    return { sessions: sessions.slice(start, start + size), total: sessions.length };
  };

  listSessionMessages: SessionPersistence["listSessionMessages"] = async (id) => (await this.getSession(id))?.messages ?? [];

  listSessionMessagePage: SessionPersistence["listSessionMessagePage"] = async ({ sessionId, limit, cursor }) => {
    const record = await this.getSession(sessionId);
    if (!record) return null;
    const total = record.messages.length;
    const decoded = cursor ? Buffer.from(cursor, "base64url").toString() : `v1:${total + 1}`;
    const boundary = Number(decoded.slice(3));
    if (!/^v1:[1-9]\d*$/.test(decoded) || !Number.isSafeInteger(boundary) || boundary > total + 1) throw new SessionMessageCursorError();
    const end = boundary - 1;
    const start = Math.max(0, end - Math.min(200, Math.max(1, Math.floor(limit) || 40)));
    const encode = (ordinal: number) => Buffer.from(`v1:${ordinal}`).toString("base64url");
    const messages = record.messages.slice(start, end);
    return { messages, total, messageDetailCursors: Object.fromEntries(messages.map((message, index) => [message.id, encode(start + index + 1)])),
      pageInfo: { startCursor: messages.length ? encode(start + 1) : null, hasPreviousPage: start > 0 },
      contextWindow: await this.getSessionMessageProjectionContextWindow(sessionId) };
  };

  private metadata = (id: string, value: Record<string, unknown>, merge: boolean, expected?: Record<string, unknown>): Promise<boolean> =>
    this.write(id, async () => {
      const loaded = await this.load(id);
      if (!loaded) return false;
      const next = await this.storage.transaction(async (transaction) => {
        const current = await transaction.get<Head>(headKey(id)) ?? loaded.head;
        if (expected && Object.entries(expected).some(([key, value]) => JSON.stringify(current.metadata?.[key]) !== JSON.stringify(value))) return null;
        const head = { ...current, metadata: merge ? { ...current.metadata, ...value } : value };
        await transaction.put({ [headKey(id)]: head });
        return head;
      });
      if (!next) return false;
      loaded.head = next;
      return true;
    });

  setSessionMetadata: SessionPersistence["setSessionMetadata"] = ({ sessionId, metadata }) => this.metadata(sessionId, metadata, false);
  updateSessionMetadata: SessionPersistence["updateSessionMetadata"] = ({ sessionId, metadata, expectedMetadata }) => this.metadata(sessionId, metadata, true, expectedMetadata);
  synchronizeSessionMessageProjection: SessionPersistence["synchronizeSessionMessageProjection"] = async (id) => Boolean(await this.getSession(id));
  getSessionMessageProjectionContextWindow: SessionPersistence["getSessionMessageProjectionContextWindow"] = async (id) =>
    await this.storage.get<Record<string, unknown>>(`sessionContext:${id}`) ?? null;
  updateSessionMessageProjectionContextWindow: SessionPersistence["updateSessionMessageProjectionContextWindow"] = async (id, value) => {
    await this.storage.put(`sessionContext:${id}`, value);
  };
  listUnfinishedRuns: SessionPersistence["listUnfinishedRuns"] = async () =>
    [...(await this.storage.list<Head>({ prefix: "sessionHead:" })).values()].flatMap((head) => head.activeRun ? [head.activeRun] : []);

  /** Merge the durable tail into its snapshot in the caller's UI projection transaction. */
  prepareCheckpoint = async (id: string): Promise<{ entries: Record<string, unknown>; deletes: string[] }> => {
    const record = await this.getSession(id);
    const loaded = await this.load(id);
    if (!record || !loaded) throw new Error(`Session not found: ${id}`);
    if (loaded.head.activeRun) throw new Error("Cannot checkpoint an active session run");
    const changes = this.snapshots.prepareCommit(id, await this.snapshots.load(id), {
      version: 1, messages: record.messages, metadata: record.metadata ?? {},
    });
    const tail = await this.storage.list({ prefix: tailPrefix(id) });
    return { entries: { ...changes.entries, [headKey(id)]: { ...loaded.head } },
      deletes: [...changes.deletes, ...tail.keys()] };
  };
}

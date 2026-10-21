import { createNcpAgentSessionSummary, applyNcpAgentRunLifecycleEvent, SessionMessagePreparationStore,
  type SessionPersistence, type UnfinishedNcpAgentRun } from "@nextclaw/kernel";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { NcpEventType, type NcpSessionSummary } from "@nextclaw/ncp";
import { CloudflareSessionSqlStore } from "./cloudflare-session-sql.store";

type Head = Omit<AgentSessionRecord, "messages"> & { sequence: number; activeRun: UnfinishedNcpAgentRun | null;
  summary?: NcpSessionSummary; storageVersion?: 2; journalBytes?: number; journalGeneration?: string; migration?: { messages: number; tailKey?: string } };
type SourceProof = Awaited<ReturnType<NonNullable<SessionPersistence["captureCompactionSource"]>>>;
const headKey = (id: string) => `sessionHead:${id}`;
const tailPrefix = (id: string) => `sessionTail:${id}:`;

/** Host transactions and raw storage only; Kernel owns message projection and cursor semantics. */
export class CloudflareSessionStore implements SessionPersistence {
  private static readonly owners = new WeakMap<object, { writes: Map<string, Promise<unknown>>; preparation: SessionMessagePreparationStore }>();
  private readonly writes: Map<string, Promise<unknown>>;
  private readonly sql: CloudflareSessionSqlStore;
  private readonly preparation: SessionMessagePreparationStore;
  constructor(private readonly storage: DurableObjectStorage) {
    const owner = CloudflareSessionStore.owners.get(storage);
    this.writes = owner?.writes ?? new Map();
    this.sql = new CloudflareSessionSqlStore(storage, async id => (await storage.get<Head>(headKey(id)))?.journalBytes ?? null,
      async id => (await storage.get<Head>(headKey(id)))?.journalGeneration ?? null);
    this.preparation = owner?.preparation ?? new SessionMessagePreparationStore((id, signal, progress) => this.write(id, async () => {
      await this.migrateLegacy(id, signal);
      await this.sql.projection.prepareEntries(id, offset => this.sql.source(id, offset), signal, progress);
    }));
    if (!owner) CloudflareSessionStore.owners.set(storage, { writes: this.writes, preparation: this.preparation });
  }
  private write = <T>(id: string, operation: () => Promise<T>): Promise<T> => {
    const result = (this.writes.get(id) ?? Promise.resolve()).then(operation);
    const settled = result.catch(() => undefined);
    this.writes.set(id, settled);
    void settled.then(() => { if (this.writes.get(id) === settled) this.writes.delete(id); });
    return result;
  };
  private head = async (id: string): Promise<Head | null> => {
    const head = await this.storage.get<Head>(headKey(id));
    if (head) return head;
    const legacy = await this.storage.get<{ metadata?: Record<string, unknown> }>(`ncpSession:${id}`);
    return legacy ? { sessionId: id, agentId: "main", metadata: legacy.metadata ?? {}, sequence: 0,
      activeRun: null, updatedAt: new Date(0).toISOString() } : null;
  };
  prepareSessionHistory: NonNullable<SessionPersistence["prepareSessionHistory"]> = async (id, options = {}) => {
    const head = await this.head(id);
    if (!head) return null;
    const active = this.preparation.get(id);
    if (!active || !["queued", "preparing"].includes(active.status)) {
      const meta = await this.sql.projection.readMeta(id);
      if (head.storageVersion === 2 && meta && meta.projectedJournalOffset === head.journalBytes && meta.journalIdentity === head.journalGeneration)
        return { status: "ready", processedBytes: head.journalBytes ?? 0, totalBytes: head.journalBytes ?? 0 };
      this.preparation.start(id, head.journalBytes ?? 0, options.retry || active?.status === "ready");
    }
    if (options.wait) await this.preparation.wait(id);
    return this.preparation.get(id);
  };
  cancelSessionHistoryPreparation = (id: string): boolean => this.preparation.cancel(id);

  private migrateLegacy = async (id: string, signal: AbortSignal): Promise<void> => {
    let head = await this.head(id);
    if (!head || head.storageVersion === 2) return;
    const index = await this.storage.get<{ messageIds: string[] }>(`ncpSession:${id}`);
    const progress = head.migration ?? { messages: 0 };
    for (let position = progress.messages; position < (index?.messageIds.length ?? 0); position++) {
      signal.throwIfAborted();
      const key = `ncpMessage:${id}:${index!.messageIds[position]}`;
      const value = await this.storage.get<Record<string, unknown>>(key);
      if (!value) throw new Error("Legacy session message source is missing.");
      const sequence = head.sequence + 1;
      const storage = this.storage;
      async function* fragments() {
        yield `{"_type":"event","seq":${sequence},"event":{"type":"session.snapshot.message","payload":{"message":`;
        if ("chunks" in value!) {
          const count = Number(value!.chunks);
          if (!Number.isInteger(count) || count < 1 || count > 256) throw new Error("Legacy source chunk header is invalid.");
          for (let part = 0; part < count; part++) {
            signal.throwIfAborted();
            const content = await storage.get<string>(`${key}:${part}`);
            if (typeof content !== "string") throw new Error("Legacy session body fragment is missing.");
            yield content;
          }
        } else yield JSON.stringify(value);
        yield "}}}\n";
      }
      await storage.transaction(async transaction => {
        const end = await this.sql.appendFragments(id, sequence, head!.journalBytes ?? 0, fragments());
        progress.messages = position + 1;
        head = { ...head!, journalBytes: end, sequence, migration: { ...progress } };
        await transaction.put({ [headKey(id)]: head });
      });
    }
    let cursor = progress.tailKey;
    for (;;) {
      signal.throwIfAborted();
      const rows = await this.storage.list<string>({ prefix: tailPrefix(id), limit: 1, ...(cursor ? { startAfter: cursor } : {}) });
      const first = rows.keys().next().value as string | undefined;
      if (!first) break;
      const prefix = first.slice(0, first.lastIndexOf(":"));
      const sequence = head.sequence + 1;
      const storage = this.storage;
      let last = first;
      async function* fragments() {
        yield `{"_type":"event","seq":${sequence},"event":`;
        let after: string | undefined;
        for (;;) {
          signal.throwIfAborted();
          const part = await storage.list<string>({ prefix: `${prefix}:`, limit: 1, ...(after ? { startAfter: after } : {}) });
          const next = part.entries().next().value as [string, string] | undefined;
          if (!next) break;
          last = after = next[0]; yield next[1];
        }
        yield "}\n";
      }
      await storage.transaction(async transaction => {
        const end = await this.sql.appendFragments(id, sequence, head!.journalBytes ?? 0, fragments());
        head = { ...head!, sequence, journalBytes: end, migration: { ...progress, tailKey: last } };
        await transaction.put({ [headKey(id)]: head });
      });
      cursor = last;
    }
    await this.storage.put(headKey(id), { ...head, journalGeneration: head.journalGeneration ?? crypto.randomUUID(), journalBytes: head.journalBytes ?? 0, storageVersion: 2, migration: undefined });
  };

  appendSessionEvent: SessionPersistence["appendSessionEvent"] = async ({ sessionId: id, event, signal }) => {
    await this.prepareSessionHistory(id, { wait: true });
    return this.write(id, async () => this.storage.transaction(async transaction => {
      signal?.throwIfAborted();
      const head = await this.head(id);
      if (!head) throw new Error(`Session not found: ${id}`);
      if (event.type === NcpEventType.MessageSent && event.payload.message.metadata?.nextclaw_timeline_kind === "context_compaction") {
        const checkpoint = event.payload.message.metadata.checkpoint as { status?: string; source?: SourceProof };
        if (checkpoint.status === "compressed" && checkpoint.source && !await this.sql.projection.validateSource(id, checkpoint.source))
          throw Object.assign(new Error("Compaction source changed before durable installation."), { code: "CONTEXT_COMPACTION_STALE", journalCommitRejected: true });
      }
      const previousOffset = head.journalBytes ?? 0;
      const sequence = head.sequence + 1;
      const timestamp = new Date().toISOString();
      const end = this.sql.append(id, sequence, previousOffset, { _type: "event", seq: sequence, timestamp, event });
      if (!await this.sql.projection.appendEvent(id, event, end, sequence + 1, previousOffset, timestamp)) throw new Error("Session projection is not ready for an incremental append.");
      const meta = await this.sql.projection.readMeta(id);
      const page = await this.sql.projection.readPage({ sessionId: id, limit: 1 });
      const next = { ...head, sequence, journalBytes: end, updatedAt: new Date().toISOString(), activeRun: applyNcpAgentRunLifecycleEvent(id, head.activeRun, event) };
      const summary = createNcpAgentSessionSummary({ ...next, messages: page?.messages ?? [] });
      next.summary = { ...summary, messageCount: meta?.total ?? summary.messageCount, metadata: head.metadata };
      signal?.throwIfAborted();
      await transaction.put({ [headKey(id)]: next });
    }));
  };
  importSessionSnapshot: SessionPersistence["importSessionSnapshot"] = record => this.write(record.sessionId, async () => this.storage.transaction(async transaction => {
    const id = record.sessionId;
    await this.sql.delete(id);
    const { messages, ...fields } = record;
    let end = 0;
    for (const [index, message] of messages.entries()) end = this.sql.append(id, index + 1, end,
      { _type: "event", seq: index + 1, event: { type: "session.snapshot.message", payload: { message } } });
    const head: Head = { ...fields, journalGeneration: crypto.randomUUID(), storageVersion: 2, sequence: messages.length, journalBytes: end, activeRun: null, summary: createNcpAgentSessionSummary(record) };
    await transaction.put({ [headKey(id)]: head });
    await this.sql.projection.rebuild({ sessionId: id, messages, projectedJournalOffset: end, nextSeq: messages.length + 1, journalIdentity: head.journalGeneration });
  }));
  loadSessionRunSeed = async (id: string) => {
    await this.writes.get(id);
    await this.prepareSessionHistory(id, { wait: true });
    return (await this.sql.projection.readRunWindow(id))?.messages ?? [];
  };
  getBoundedSession = async (id: string): Promise<AgentSessionRecord | null> => {
    const head = await this.head(id);
    return head ? { sessionId: id, agentId: head.agentId, metadata: head.metadata, createdAt: head.createdAt, updatedAt: head.updatedAt,
      messages: await this.loadSessionRunSeed(id) } : null;
  };
  getSession: SessionPersistence["getSession"] = async id => {
    const record = await this.getBoundedSession(id);
    return record ? { ...record, messages: await this.listSessionMessages(id) } : null;
  };
  listSessionMessages = async (id: string) => {
    await this.prepareSessionHistory(id, { wait: true });
    return (await this.sql.projection.readAll(id))?.messages ?? [];
  };
  listSessionMessagePage: SessionPersistence["listSessionMessagePage"] = async params => {
    const preparation = await this.prepareSessionHistory(params.sessionId);
    if (!preparation) return null;
    return preparation.status === "ready" ? this.sql.projection.listPage(params) : {
      messages: [], total: 0, messageDetailCursors: {}, pageInfo: { startCursor: null, hasPreviousPage: false }, contextWindow: null, preparation };
  };
  readSessionMessagePart: NonNullable<SessionPersistence["readSessionMessagePart"]> = async params => {
    await this.prepareSessionHistory(params.sessionId, { wait: true });
    return this.sql.projection.readPart(params.sessionId, params.messageId, params.part, params.cursor);
  };
  listSessionQuestionMessages = async (id: string, questionId?: string) => {
    await this.prepareSessionHistory(id, { wait: true }); return this.sql.projection.readQuestionMessages(id, questionId);
  };
  captureCompactionSource = async (id: string, ids: readonly string[]) => {
    await this.writes.get(id); await this.prepareSessionHistory(id, { wait: true }); return this.sql.projection.captureSource(id, ids);
  };
  findSessionMessageByIngressKey = async (id: string, key: string) => {
    await this.prepareSessionHistory(id, { wait: true }); return this.sql.projection.findIngressMessage(id, key);
  };
  synchronizeSessionMessageProjection = async (id: string) => Boolean(await this.prepareSessionHistory(id, { wait: true, retry: true }));
  getSessionMessageProjectionContextWindow = async (id: string) => (await this.sql.projection.readMeta(id))?.contextWindow ?? null;
  updateSessionMessageProjectionContextWindow = async (id: string, value: Record<string, unknown>) => this.sql.projection.updateContextWindow(id, value);
  getSessionSummary: SessionPersistence["getSessionSummary"] = async id => {
    await this.writes.get(id); const head = await this.head(id);
    return head ? { ...head.summary ?? createNcpAgentSessionSummary({ ...head, messages: [] }), metadata: head.metadata,
      updatedAt: head.updatedAt, status: head.activeRun ? "running" : "idle" } : null;
  };
  listSessionSummaries: SessionPersistence["listSessionSummaries"] = async options => {
    const rows = await this.storage.list<Head>({ prefix: "sessionHead:" });
    const summaries = [...rows.values()].map(head => ({ ...head.summary ?? createNcpAgentSessionSummary({ ...head, messages: [] }), metadata: head.metadata,
      updatedAt: head.updatedAt, status: head.activeRun ? "running" as const : "idle" as const }));
    summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return options?.limit === undefined ? summaries : summaries.slice(0, options.limit);
  };
  listSessionSummaryPage: SessionPersistence["listSessionSummaryPage"] = async ({ page, pageSize, query, peerId, scheduledOnly }) => {
    const normalized = query?.trim().toLowerCase();
    const sessions = (await this.listSessionSummaries()).filter(session => {
      const scheduled = session.metadata?.session_origin === "cron" || Boolean(session.metadata?.cron_job_id) || session.sessionId.startsWith("cron:");
      return (!peerId?.trim() || session.peerId === peerId.trim()) && (!scheduledOnly || scheduled)
        && (!normalized || `${session.sessionId} ${session.metadata?.label ?? ""}`.toLowerCase().includes(normalized));
    });
    const size = Math.max(1, Math.floor(pageSize));
    return { sessions: sessions.slice(Math.max(0, page - 1) * size, Math.max(0, page - 1) * size + size), total: sessions.length };
  };
  private metadata = (id: string, metadata: Record<string, unknown>, merge: boolean, expected?: Record<string, unknown>) => this.write(id, async () => this.storage.transaction(async transaction => {
    const head = await this.head(id);
    if (!head || (expected && Object.entries(expected).some(([key, value]) => JSON.stringify(head.metadata?.[key]) !== JSON.stringify(value)))) return false;
    await transaction.put({ [headKey(id)]: { ...head, metadata: merge ? { ...head.metadata, ...metadata } : metadata } }); return true;
  }));
  setSessionMetadata: SessionPersistence["setSessionMetadata"] = params => this.metadata(params.sessionId, params.metadata, false);
  updateSessionMetadata: SessionPersistence["updateSessionMetadata"] = params => this.metadata(params.sessionId, params.metadata, true, params.expectedMetadata);
  listUnfinishedRuns: SessionPersistence["listUnfinishedRuns"] = async () =>
    [...(await this.storage.list<Head>({ prefix: "sessionHead:" })).values()].flatMap(head => head.activeRun ? [head.activeRun] : []);
  deleteSession: SessionPersistence["deleteSession"] = async id => {
    const record = await this.getBoundedSession(id);
    const keys = await this.prepareDelete(id);
    await this.write(id, async () => this.storage.transaction(async transaction => {
      await this.deleteSqlSource(id);
      for (let offset = 0; offset < keys.length; offset += 128) await transaction.delete(keys.slice(offset, offset + 128));
    }));
    return record;
  };
  prepareDelete = async (id: string): Promise<string[]> => {
    this.cancelSessionHistoryPreparation(id);
    await this.writes.get(id);
    const keys = [headKey(id), `sessionContext:${id}`, `ncpSession:${id}`];
    const index = await this.storage.get<{ messageIds: string[] }>(`ncpSession:${id}`);
    for (const messageId of index?.messageIds ?? []) {
      const key = `ncpMessage:${id}:${messageId}`;
      keys.push(key);
      const value = await this.storage.get<{ chunks?: number }>(key);
      for (let part = 0; part < Math.min(256, value?.chunks ?? 0); part++) keys.push(`${key}:${part}`);
    }
    keys.push(...(await this.storage.list({ prefix: tailPrefix(id) })).keys());
    return keys;
  };
  deleteSqlSource = (id: string): Promise<void> => this.sql.delete(id);
  prepareCheckpoint = async (id: string): Promise<{ entries: Record<string, unknown>; deletes: string[] }> => {
    await this.writes.get(id);
    if (!(await this.head(id))) throw new Error(`Session not found: ${id}`);
    // Events are already committed; saving UI metadata never rewrites archived history.
    return { entries: {}, deletes: [] };
  };
}

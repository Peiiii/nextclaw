import { createHash } from "node:crypto";
import type { NcpMessage } from "@nextclaw/ncp";
import { SessionMessageCursorError, type SessionMessagePage } from "@kernel/types/session.types.js";
import {
  decodeNcpAgentSessionMessageCursor, encodeNcpAgentSessionMessageCursor,
  NCP_AGENT_SESSION_MESSAGE_PROJECTION_VERSION, type NcpAgentSessionMessageProjectionMeta,
} from "@kernel/utils/ncp-agent-session-message-projection.utils.js";
import { buildSessionMessageDescriptor, SESSION_PAGE_BYTES, SESSION_RUN_BYTES } from "@kernel/utils/session-message-chunks.utils.js";
import type { SqliteDatabase } from "./sqlite-database.store.js";
import { SessionMessagePartsStore } from "./session-message-parts.store.js";
import type { NcpAgentSessionJournalReplayEvent } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { SessionEventProjectionStore } from "./session-event-projection.store.js";
import { readCompressedContextCompactionCheckpoint, projectContextCompactionStatus, type ContextCompactionCheckpoint } from "@nextclaw/core/context-compaction";
import { CONTEXT_COMPACTION_PART_START } from "@kernel/features/context-compaction/utils/context-compaction.utils.js";
import { MODEL_ROUND_PART_OFFSETS } from "@nextclaw/ncp-agent-runtime";

export type ReadProjectionPageParams = { sessionId: string; limit: number; cursor?: string; tailMessages?: readonly NcpMessage[] };
export type ReadProjectionMessagesResult = { messages: NcpMessage[]; meta: NcpAgentSessionMessageProjectionMeta };
export type MessageRow = { ordinal: number; id: string; descriptor: string; revision: string; bytes: number };
type PartCursor = { sessionId: string; messageId: string; revision: string; part: number; field: number; chunk: number };

export type SessionMessageProjectionHost = {
  database: (sessionId: string, create: boolean) => Promise<SqliteDatabase | null>;
  journalBytes: (sessionId: string) => Promise<number | null>;
  journalIdentity: (sessionId: string) => Promise<string | null>;
  delete: (sessionId: string) => Promise<void>;
  transaction: <T>(operation: () => Promise<T>) => Promise<T>;
};

/** Derived, transactional index. Original journal remains the sole replay authority. */
export class SessionMessageSqlProjectionStore {
  constructor(private readonly host: SessionMessageProjectionHost) {}

  journalBytes = (sessionId: string): Promise<number | null> => this.host.journalBytes(sessionId);
  journalIdentity = (sessionId: string): Promise<string | null> => this.host.journalIdentity(sessionId);
  protected database = async (sessionId: string, create = false): Promise<SqliteDatabase | null> => {
    const database = await this.host.database(sessionId, create);
    if (database && create) this.initializeSchema(database);
    return database;
  };

  private initializeSchema = (database: SqliteDatabase): void => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS projection_meta (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (ordinal INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, descriptor TEXT NOT NULL, revision TEXT NOT NULL, bytes INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS tool_owners (call_id TEXT PRIMARY KEY, message_id TEXT NOT NULL, part INTEGER NOT NULL) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS messages_identity ON messages(id,revision);
      CREATE INDEX IF NOT EXISTS messages_source ON messages(ordinal,id,revision);
      CREATE INDEX IF NOT EXISTS messages_page ON messages(ordinal,id,revision,bytes);
      CREATE INDEX IF NOT EXISTS messages_ingress ON messages(json_extract(descriptor,'$.metadata.nextclaw_ingress_idempotency_key'));
      CREATE INDEX IF NOT EXISTS messages_pending_compaction ON messages(json_extract(descriptor,'$.metadata.checkpoint.status'),ordinal)
        WHERE json_extract(descriptor,'$.metadata.nextclaw_timeline_kind')='context_compaction';
    `);
    new SessionMessagePartsStore(database).initialize();
  };

  protected meta = (database: SqliteDatabase, sessionId: string, preparing = false): NcpAgentSessionMessageProjectionMeta | null => {
    const row = database.prepare("SELECT value FROM projection_meta WHERE id=1").get() as { value: string } | undefined;
    if (!row) return null;
    const meta = JSON.parse(row.value) as NcpAgentSessionMessageProjectionMeta;
    return meta.version === NCP_AGENT_SESSION_MESSAGE_PROJECTION_VERSION && meta.sessionId === sessionId
      && (preparing || !meta.preparation || meta.preparation.status === "ready") ? meta : null;
  };

  readMeta = async (sessionId: string, preparing = false): Promise<NcpAgentSessionMessageProjectionMeta | null> => {
    const database = await this.database(sessionId);
    if (!database) return null;
    try { return this.meta(database, sessionId, preparing); } finally { database.close(); }
  };

  captureSource = async (sessionId: string, messageIds: readonly string[]): Promise<NonNullable<ContextCompactionCheckpoint["source"]>> => {
    const database = await this.database(sessionId);
    if (!database) throw new Error("Compaction source index is unavailable.");
    try {
      const meta = this.meta(database, sessionId);
      const journalGeneration = await this.journalIdentity(sessionId);
      if (!meta || !journalGeneration || meta.journalIdentity !== journalGeneration || meta.projectedJournalOffset !== await this.journalBytes(sessionId)) throw new Error("Compaction source index has not caught up to durable history.");
      const ids = [...new Set(messageIds)];
      const selected = ids.length <= 256 ? ids : [ids[0]!, ...ids.slice(-255)];
      const rows = selected.map(id => database.prepare("SELECT ordinal,id,revision FROM messages INDEXED BY messages_identity WHERE id=?").get(id) as { ordinal: number; id: string; revision: string } | undefined);
      if (rows.some(row => !row)) throw new Error("Compaction source contains a message not present in durable history.");
      const sorted = (rows as { ordinal: number; id: string; revision: string }[]).sort((left, right) => left.ordinal - right.ordinal);
      const ranges: { from: number; to: number }[] = [];
      for (const row of sorted) {
        if (ranges.at(-1)?.to === row.ordinal - 1) ranges.at(-1)!.to = row.ordinal;
        else ranges.push({ from: row.ordinal, to: row.ordinal });
      }
      const retained = ranges.length <= 16 ? ranges : [ranges[0]!, ...ranges.slice(-15)];
      const proof = { journalWatermark: meta.projectedJournalOffset, ranges: retained,
        revisionDigest: this.sourceDigest(database, retained), sourceCount: sorted.filter(row => retained.some(range => row.ordinal >= range.from && row.ordinal <= range.to)).length,
        omittedRangeCount: ranges.length - retained.length + Math.max(0, ids.length - selected.length) };
      return { ...proof, semanticRevision: meta.semanticRevision ?? 0, journalGeneration };
    } finally { database.close(); }
  };

  validateSource = async (sessionId: string, source: NonNullable<ContextCompactionCheckpoint["source"]>): Promise<boolean> => {
    const database = await this.database(sessionId);
    if (!database) return false;
    try {
      const meta = this.meta(database, sessionId);
      return Boolean(meta && source.journalGeneration && source.journalGeneration === await this.journalIdentity(sessionId)
        && meta.journalIdentity === source.journalGeneration && meta.projectedJournalOffset === await this.journalBytes(sessionId)
        && (meta.semanticRevision ?? 0) === source.semanticRevision && this.sourceDigest(database, source.ranges) === source.revisionDigest);
    }
    finally { database.close(); }
  };

  private sourceDigest = (database: SqliteDatabase, ranges: { from: number; to: number }[]): string => {
    if (ranges.length > 16) throw new Error("Compaction source manifest exceeds its range budget.");
    const hash = createHash("sha256");
    let count = 0;
    for (const range of ranges) {
      if (!Number.isSafeInteger(range.from) || !Number.isSafeInteger(range.to) || range.from < 1 || range.to < range.from || range.to - range.from >= 256) throw new Error("Invalid compaction source range.");
      const rows = database.prepare("SELECT ordinal,id,revision FROM messages INDEXED BY messages_source WHERE ordinal>=? AND ordinal<=? ORDER BY ordinal LIMIT 257").all(range.from, range.to) as { ordinal: number; id: string; revision: string }[];
      count += rows.length;
      if (count > 256 || rows.length !== range.to - range.from + 1) throw new Error("Compaction source range is incomplete or exceeds its window budget.");
      for (const row of rows) hash.update(JSON.stringify([row.ordinal, row.id, row.revision]));
    }
    return hash.digest("hex");
  };

  /** Host stream adapter; entry application and its watermark share the host transaction. */
  prepareEntries = async (sessionId: string, source: (offset: number) => AsyncIterable<string | Uint8Array>, signal?: AbortSignal,
    onProgress?: (bytes: number, total: number) => void): Promise<void> => {
    const total = await this.journalBytes(sessionId);
    if (total === null) throw new Error("Session source does not exist.");
    const database = (await this.database(sessionId, true))!;
    const journalIdentity = (await this.journalIdentity(sessionId))!;
    let meta = this.meta(database, sessionId, true);
    if (!meta || meta.projectedJournalOffset > total || meta.journalIdentity !== journalIdentity) {
      await this.host.transaction(async () => { await this.rebuild({ sessionId, messages: [], projectedJournalOffset: 0, nextSeq: 1 }); });
      meta = this.meta(database, sessionId, true)!;
    }
    const projector = new SessionEventProjectionStore(database, meta);
    meta.preparation = { status: "preparing", journalBytes: total };
    this.writeMeta(database, meta);
    projector.parts.clearStaging();
    const { scanBoundedSessionJournal } = await import("@kernel/utils/session-journal-stream.utils.js");
    await scanBoundedSessionJournal({ input: source(meta.projectedJournalOffset), startOffset: meta.projectedJournalOffset, endOffset: total, signal,
      onToken: (token, path) => projector.parts.captureToken(token, path),
      onProgress: bytes => onProgress?.(Math.min(bytes, total), total),
      onEntry: async (entry, boundary) => {
        this.assertSupportedEntry(entry);
        signal?.throwIfAborted();
        await this.host!.transaction(async () => {
          if (entry._type === "event" && (entry.event as { type?: unknown } | undefined)?.type) {
            await projector.apply(entry.event as NcpAgentSessionJournalReplayEvent, true, signal, false, typeof entry.timestamp === "string" ? entry.timestamp : undefined);
            meta!.nextSeq = Math.max(meta!.nextSeq ?? 1, Number(entry.seq ?? 0) + 1);
          }
          await projector.parts.clearStagingBounded(signal); meta!.projectedJournalOffset = boundary; this.writeMeta(database, meta!);
        });
        onProgress?.(boundary, total);
      },
    });
    signal?.throwIfAborted();
    meta.preparation = { status: "ready", journalBytes: total }; this.writeMeta(database, meta);
  };

  appendEvent = async (sessionId: string, event: NcpAgentSessionJournalReplayEvent, journalOffset: number, nextSeq: number, previousOffset?: number, timestamp?: string): Promise<boolean> => {
    const database = await this.database(sessionId);
    if (!database) return false;
    try {
      const meta = this.meta(database, sessionId);
      if (!meta) return false;
      const identity = await this.journalIdentity(sessionId);
      if (identity !== meta.journalIdentity) {
        if (meta.total !== 0 || meta.projectedJournalOffset !== 0 || previousOffset !== 0 || !identity) return false;
        meta.journalIdentity = identity;
      }
      if (meta.projectedJournalOffset >= journalOffset) return true;
      if (previousOffset !== undefined && meta.projectedJournalOffset !== previousOffset) return false;
      database.exec("BEGIN IMMEDIATE");
      try {
        await new SessionEventProjectionStore(database, meta).apply(event, false, undefined, false, timestamp);
        meta.projectedJournalOffset = journalOffset; meta.nextSeq = nextSeq;
        this.writeMeta(database, meta); database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
      return true;
    } finally { database.close(); }
  };

  rebuild = async (params: {
    sessionId: string; messages: readonly NcpMessage[]; projectedJournalOffset: number;
    contextWindow?: Record<string, unknown> | null;
    nextSeq?: number;
    journalIdentity?: string;
  }): Promise<void> => {
    const database = (await this.database(params.sessionId, true))!;
    const journalIdentity = params.journalIdentity ?? (await this.journalIdentity(params.sessionId)) ?? undefined;
    try {
      database.exec("BEGIN IMMEDIATE");
      try {
        database.exec("DELETE FROM messages; DELETE FROM part_fields; DELETE FROM part_chunks; DELETE FROM part_previews; DELETE FROM tool_owners; DELETE FROM settled_tools; DELETE FROM session_questions; DELETE FROM session_interruptions; DELETE FROM interruption_fields; DELETE FROM interruption_chunks;");
        const meta: NcpAgentSessionMessageProjectionMeta = {
          version: NCP_AGENT_SESSION_MESSAGE_PROJECTION_VERSION, sessionId: params.sessionId,
          total: 0, dataBytes: 0, projectedJournalOffset: params.projectedJournalOffset,
          contextWindow: params.contextWindow ?? null, activeMessageId: null, pendingCompactionMessageIds: [],
          nextSeq: params.nextSeq,
          journalIdentity,
        };
        await this.writeMessages(database, meta, params.messages);
        this.writeMeta(database, meta);
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
    } finally { database.close(); }
  };

  synchronize = async (params: { sessionId: string; messages: readonly NcpMessage[]; projectedJournalOffset: number }): Promise<boolean> => {
    const database = await this.database(params.sessionId);
    if (!database) return false;
    try {
      const meta = this.meta(database, params.sessionId);
      if (!meta) return false;
      database.exec("BEGIN IMMEDIATE");
      try {
        await this.writeMessages(database, meta, params.messages);
        meta.projectedJournalOffset = params.projectedJournalOffset;
        this.writeMeta(database, meta);
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
      return true;
    } finally { database.close(); }
  };

  private writeMessages = async (database: SqliteDatabase, meta: NcpAgentSessionMessageProjectionMeta, messages: readonly NcpMessage[]): Promise<void> => {
    const projector = new SessionEventProjectionStore(database, meta);
    for (const message of messages) await projector.applySnapshot(message, false);
  };

  protected writeMeta = (database: SqliteDatabase, meta: NcpAgentSessionMessageProjectionMeta): void => {
    database.prepare("INSERT OR REPLACE INTO projection_meta(id,value) VALUES (1,?)").run(JSON.stringify(meta));
  };

  protected assertSupportedEntry = (entry: Record<string, unknown>): void => {
    if (entry.version !== undefined && entry.version !== 1) throw new Error("Session journal entry version is unsupported; original history is retained.");
    if (entry._type === "metadata") return;
    if (entry._type !== "event" || !(entry.event as { type?: unknown } | undefined)?.type) throw new Error("Session journal entry has no valid event identity; refusing incomplete projection.");
  };

  synchronizeJournalTail = async (params: { sessionId: string; journalOffset: number }): Promise<boolean> => {
    const meta = await this.readMeta(params.sessionId);
    if (!meta) return false;
    return this.synchronize({ ...params, projectedJournalOffset: params.journalOffset,
      messages: await this.readJournalTailMessages(params.sessionId, meta) });
  };

  updateContextWindow = async (sessionId: string, contextWindow: Record<string, unknown> | null): Promise<void> => {
    const database = await this.database(sessionId);
    if (!database) return;
    try {
      const meta = this.meta(database, sessionId);
      if (meta) { meta.contextWindow = contextWindow; this.writeMeta(database, meta); }
    } finally { database.close(); }
  };

  listPage = async (params: Omit<ReadProjectionPageParams, "tailMessages">): Promise<SessionMessagePage | null> => {
    const meta = await this.readMeta(params.sessionId);
    if (!meta) return null;
    if (meta.projectedJournalOffset !== await this.journalBytes(params.sessionId)) return null;
    return this.readPage(params);
  };

  readPage = async (params: ReadProjectionPageParams): Promise<SessionMessagePage | null> => {
    const database = await this.database(params.sessionId);
    if (!database) return null;
    try {
      const meta = this.meta(database, params.sessionId);
      if (!meta) return null;
      const limit = Number.isFinite(params.limit) ? Math.min(200, Math.max(1, Math.trunc(params.limit))) : 40;
      const boundary = params.cursor ? decodeNcpAgentSessionMessageCursor(params.cursor, meta.total + 1) : meta.total + 1;
      const rows = database.prepare("SELECT ordinal,id,revision,bytes FROM messages INDEXED BY messages_page WHERE ordinal<? ORDER BY ordinal DESC LIMIT ?").all(boundary, limit) as Omit<MessageRow, "descriptor">[];
      const tail = new Map((params.tailMessages ?? []).map(message => [message.id, message]));
      const selected: { ordinal: number; message: NcpMessage }[] = [];
      let bytes = 0;
      if (!params.cursor) for (const message of tail.values()) {
        if (database.prepare("SELECT ordinal FROM messages WHERE id=?").get(message.id)) continue;
        const descriptor = buildSessionMessageDescriptor(message, "pending");
        const size = Buffer.byteLength(JSON.stringify(descriptor));
        if (bytes + size > SESSION_PAGE_BYTES || selected.length >= limit) break;
        selected.push({ ordinal: meta.total + selected.length + 1, message: descriptor });
        bytes += size;
      }
      let sourceBytes = 0;
      for (const identity of rows) {
        if (selected.length >= limit) break;
        if (sourceBytes >= 2.5 * 1024 * 1024 && selected.length) break;
        const stored = database.prepare("SELECT descriptor FROM messages WHERE id=?").get(identity.id) as { descriptor: string };
        const row = { ...identity, descriptor: stored.descriptor };
        sourceBytes += Buffer.byteLength(row.descriptor) + (row.bytes <= 16 * 1024 ? row.bytes : 0);
        const replacement = tail.get(row.id);
        const message = replacement ? buildSessionMessageDescriptor(replacement, "pending")
          : row.bytes <= 16 * 1024 ? this.assemble(database, row) : JSON.parse(row.descriptor) as NcpMessage;
        if (message.metadata?.nextclaw_timeline_kind === "context_compaction") message.metadata = {
          nextclaw_timeline_kind: "context_compaction", checkpoint: projectContextCompactionStatus(message.metadata.checkpoint),
          nextclaw_source: message.metadata.nextclaw_source,
        };
        const size = Buffer.byteLength(JSON.stringify(message));
        if (bytes + size > SESSION_PAGE_BYTES && selected.length) break;
        bytes += size;
        selected.push({ ordinal: row.ordinal, message });
      }
      selected.sort((left, right) => left.ordinal - right.ordinal);
      const first = selected[0]?.ordinal ?? boundary;
      return {
        messages: selected.map(item => item.message), total: meta.total + (selected.filter(item => item.ordinal > meta.total).length),
        messageDetailCursors: Object.fromEntries(selected.map(item => [item.message.id, encodeNcpAgentSessionMessageCursor(item.ordinal + 1)])),
        pageInfo: { startCursor: selected.length ? encodeNcpAgentSessionMessageCursor(first) : null, hasPreviousPage: first > 1 },
        contextWindow: meta.contextWindow,
      };
    } finally { database.close(); }
  };

  readPart = async (sessionId: string, messageId: string, part: number, cursor?: string) => {
    const database = await this.database(sessionId);
    if (!database) return null;
    try {
      const row = database.prepare("SELECT revision FROM messages WHERE id=?").get(messageId) as { revision: string } | undefined;
      if (!row) return null;
      let chunk = 0;
      let field = 0;
      if (cursor) {
        let decoded: PartCursor;
        try { decoded = JSON.parse(Buffer.from(cursor, "base64url").toString()); } catch { throw new SessionMessageCursorError(); }
        if (decoded.sessionId !== sessionId || decoded.messageId !== messageId || decoded.part !== part
          || decoded.revision !== row.revision || !Number.isSafeInteger(decoded.chunk) || decoded.chunk < 0
          || !Number.isSafeInteger(decoded.field) || decoded.field < 0) throw new SessionMessageCursorError("History cursor is stale or does not match this source.");
        chunk = decoded.chunk;
        field = decoded.field;
      }
      const parts = new SessionMessagePartsStore(database);
      let position: { field: number; chunk: number } | null = { field, chunk };
      let content = "";
      for (let reads = 0; reads < 128 && position; reads++) {
        const value = parts.readFragment(messageId, part, position);
        if (!value) return content ? { sessionId, messageId, part, revision: row.revision, chunk, format: "json-fragment" as const, content, nextCursor: null } : null;
        if (content && Buffer.byteLength(content) + Buffer.byteLength(value.content) > 24 * 1024) break;
        content += value.content; position = value.next;
      }
      return { sessionId, messageId, part, revision: row.revision, chunk, format: "json-fragment" as const, content,
        nextCursor: position ? Buffer.from(JSON.stringify({ sessionId, messageId, revision: row.revision, part, ...position })).toString("base64url") : null };
    } finally { database.close(); }
  };

  readAll = async (sessionId: string): Promise<ReadProjectionMessagesResult | null> => {
    const database = await this.database(sessionId);
    if (!database) return null;
    try {
      const meta = this.meta(database, sessionId);
      if (!meta) return null;
      const rows = database.prepare("SELECT ordinal,id,descriptor,revision,bytes FROM messages ORDER BY ordinal").all() as MessageRow[];
      const messages = rows.map(row => this.assemble(database, row));
      const byId = new Map(messages.map(message => [message.id, message]));
      for (const message of await this.readJournalTailMessages(sessionId, meta)) byId.set(message.id, message);
      return { meta, messages: [...byId.values()] };
    } finally { database.close(); }
  };

  readQuestionMessages = async (sessionId: string, questionId?: string): Promise<NcpMessage[]> => {
    const database = await this.database(sessionId);
    if (!database) return [];
    try {
      const rows = questionId ? database.prepare("SELECT message_id,resolution_id FROM session_questions WHERE id=?").all(questionId)
        : [...database.prepare("SELECT message_id,resolution_id FROM session_questions WHERE resolution_id IS NULL AND message_id IS NOT NULL ORDER BY asked_at,id LIMIT 32").all(),
          ...database.prepare("SELECT message_id,resolution_id FROM session_questions WHERE resolution_id IS NOT NULL AND message_id IS NOT NULL ORDER BY asked_at DESC,id DESC LIMIT 32").all()];
      const ids = new Set((rows as { message_id: string; resolution_id: string | null }[]).flatMap(row => [row.message_id, row.resolution_id].filter((id): id is string => Boolean(id))));
      const messages: NcpMessage[] = [];
      for (const id of ids) {
        const row = database.prepare("SELECT ordinal,id,descriptor,revision,bytes FROM messages WHERE id=?").get(id) as MessageRow | undefined;
        if (row) messages.push(row.bytes <= 64 * 1024 ? this.assemble(database, row) : JSON.parse(row.descriptor) as NcpMessage);
      }
      return messages;
    } finally { database.close(); }
  };

  findIngressMessage = async (sessionId: string, key: string): Promise<NcpMessage | null> => {
    const database = await this.database(sessionId);
    if (!database) return null;
    try {
      const row = database.prepare("SELECT ordinal,id,descriptor,revision,bytes FROM messages INDEXED BY messages_ingress WHERE json_extract(descriptor,'$.metadata.nextclaw_ingress_idempotency_key')=? LIMIT 1").get(key) as MessageRow | undefined;
      if (!row) return null;
      const message = JSON.parse(row.descriptor) as NcpMessage;
      if (typeof message.metadata?.nextclaw_ingress_content_digest === "string") return message;
      if (row.bytes > 64 * 1024) throw new Error("Archived ingress cannot be compared safely without its recorded content digest.");
      return this.assemble(database, row);
    } finally { database.close(); }
  };

  protected assemble = (database: SqliteDatabase, row: MessageRow): NcpMessage => {
    const message = JSON.parse(row.descriptor) as NcpMessage;
    message.parts = new SessionMessagePartsStore(database).assemble(row.id);
    delete message.metadata?.nextclaw_source;
    return message;
  };

  readRunWindow = async (sessionId: string): Promise<ReadProjectionMessagesResult | null> => {
    const database = await this.database(sessionId);
    if (!database) return null;
    try {
      const meta = this.meta(database, sessionId);
      if (!meta) return null;
      const rows = database.prepare("SELECT ordinal,id,revision,bytes FROM messages INDEXED BY messages_page ORDER BY ordinal DESC LIMIT 254").all() as Omit<MessageRow, "descriptor">[];
      const checkpointRow = meta.latestCheckpointMessageId ? database.prepare("SELECT ordinal,id,descriptor,revision,bytes FROM messages WHERE id=?").get(meta.latestCheckpointMessageId) as MessageRow | undefined : undefined;
      const checkpoint = checkpointRow ? readCompressedContextCompactionCheckpoint((JSON.parse(checkpointRow.descriptor) as NcpMessage).metadata?.checkpoint) : null;
      const pinnedIds = [...new Set([meta.latestCheckpointMessageId, meta.latestRecoveryAcknowledgementMessageId,
        ...(checkpoint?.preservedUserMessageIds ?? []).slice(-64), ...(checkpoint?.retainedMessageIds ?? []).slice(-128), checkpoint?.continuationMessageId]
        .filter((id): id is string => Boolean(id)))];
      const pinned = pinnedIds.flatMap(id => {
        const row = database.prepare("SELECT ordinal,id,revision,bytes FROM messages WHERE id=?").get(id) as Omit<MessageRow, "descriptor"> | undefined;
        return row ? [row] : [];
      });
      const priority = [...pinned, ...rows.filter(row => !pinnedIds.includes(row.id))].slice(0, 256);
      let bytes = 0;
      let parts = 0;
      let fields = 0;
      const selected: NcpMessage[] = [];
      const partStore = new SessionMessagePartsStore(database);
      for (const identity of priority) {
        const stored = database.prepare("SELECT descriptor FROM messages WHERE id=?").get(identity.id) as { descriptor: string };
        const row = { ...identity, descriptor: stored.descriptor };
        const descriptor = JSON.parse(row.descriptor) as NcpMessage;
        const source = descriptor.metadata?.nextclaw_source as { partCount?: number; partIndices?: number[] } | undefined;
        const retainedStart = checkpoint?.retainedMessagePartStarts?.[row.id];
        const continuationStart = checkpoint?.continuationMessageId === row.id ? checkpoint.continuationMessageCoveredPartCount : undefined;
        const start = retainedStart ?? continuationStart ?? 0;
        const measured = partStore.measureView(row.id, start, Math.max(0, 4_096 - fields));
        const overhead = Buffer.byteLength(row.descriptor);
        const complete = measured.complete && measured.bytes + overhead <= SESSION_RUN_BYTES - bytes && measured.indices.length <= 1_024 - parts;
        if (bytes + (complete ? measured.bytes + overhead : overhead) > SESSION_RUN_BYTES) break;
        const message = { ...descriptor, parts: complete ? partStore.assemble(row.id, start) : descriptor.parts };
        const indices = complete ? measured.indices : source?.partIndices ?? descriptor.parts.map((_, index) => index);
        const partial = message.role === "assistant" && (!complete || start > 0);
        const preservedText = checkpoint?.truncatedPreservedUserMessage;
        if (message.role === "user" && preservedText?.messageId === row.id) message.parts = [{ type: "text", text: preservedText.text }];
        if (parts + message.parts.length > 1_024) break;
        message.metadata = { ...descriptor.metadata, nextclaw_source: { ...source, partIndices: indices },
          ...(!complete && preservedText?.messageId !== row.id ? { nextclaw_archived_body: true } : {}),
          ...(partial ? { nextclaw_partial_projection: true, [CONTEXT_COMPACTION_PART_START]: indices[0] ?? start } : {}) };
        if (partial) {
          const offsets = message.metadata[MODEL_ROUND_PART_OFFSETS];
          if (Array.isArray(offsets)) message.metadata[MODEL_ROUND_PART_OFFSETS] = offsets
            .map(offset => indices.indexOf(offset)).filter(offset => offset > 0);
        }
        bytes += Buffer.byteLength(JSON.stringify(message));
        parts += message.parts.length;
        fields += Math.min(measured.fields, 4_096 - fields);
        selected.push(message);
      }
      selected.sort((left, right) => Number((left.metadata?.nextclaw_source as { ordinal?: number } | undefined)?.ordinal ?? 0)
        - Number((right.metadata?.nextclaw_source as { ordinal?: number } | undefined)?.ordinal ?? 0));
      return { meta, messages: selected };
    } finally { database.close(); }
  };

  protected readJournalTailMessages = async (_sessionId: string, _meta: NcpAgentSessionMessageProjectionMeta): Promise<NcpMessage[]> => [];
  delete = (sessionId: string): Promise<void> => this.host.delete(sessionId);
}

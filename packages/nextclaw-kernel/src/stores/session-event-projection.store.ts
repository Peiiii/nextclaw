import { randomUUID } from "node:crypto";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import type { NcpAgentSessionJournalReplayEvent } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import type { NcpAgentSessionMessageProjectionMeta } from "@kernel/utils/ncp-agent-session-message-projection.utils.js";
import { readMessageFromSummaryEvent, readEventMessageId, readEventRunId, isReplayContinuationEvent, isStreamingMessageCreationEvent } from "@kernel/utils/ncp-agent-session-replay-event.utils.js";
import { SessionEventReplayer, mergePartialSessionMessage } from "@kernel/utils/ncp-agent-session-replay.utils.js";
import { MODEL_ROUND_PART_OFFSETS } from "@nextclaw/ncp-agent-runtime";
import { buildSessionMessageDescriptor } from "@kernel/utils/session-message-chunks.utils.js";
import { SessionMessagePartsStore } from "./session-message-parts.store.js";
import type { SqliteDatabase } from "./sqlite-database.store.js";
import { ContextCompactionJournalRecoveryService } from "@kernel/features/context-compaction/index.js";

type MessageRow = { ordinal: number; descriptor: string; bytes: number };
type Source = { partIndices?: number[]; partCount?: number };

/** Incremental materialization using the existing replayer for event semantics. */
export class SessionEventProjectionStore {
  readonly parts: SessionMessagePartsStore;
  constructor(private readonly database: SqliteDatabase, private readonly meta: NcpAgentSessionMessageProjectionMeta) {
    this.parts = new SessionMessagePartsStore(database);
  }

  apply = async (event: NcpAgentSessionJournalReplayEvent, staged = false, signal?: AbortSignal, preserveStaging = false, timestamp?: string): Promise<void> => {
    if (timestamp && "payload" in event && event.payload && typeof event.payload === "object") event = {
      ...event, payload: { ...event.payload, timestamp },
    } as unknown as NcpAgentSessionJournalReplayEvent;
    const payloadSource = preserveStaging ? "coalesced" : "payload";
    if (isReplayContinuationEvent(event)) this.restoreSupersededInterruption(event);
    if (event.type === NcpEventType.RunStarted) this.meta.activeRunId = event.payload.runId ?? event.payload.messageId ?? "legacy-active";
    const snapshot = readMessageFromSummaryEvent(event);
    if (snapshot) { await this.applySnapshot(snapshot, staged); return; }
    if (!("payload" in event)) return;
    if ([NcpEventType.RunError, NcpEventType.RunFinished, NcpEventType.MessageAbort].includes(event.type as NcpEventType)) {
      const predicate = "json_extract(descriptor,'$.metadata.nextclaw_timeline_kind')='context_compaction' AND json_extract(descriptor,'$.metadata.checkpoint.status')='compressing'";
      const continuation = "json_extract(descriptor,'$.metadata.checkpoint.continuationMessageId')";
      const eventMessageId = readEventMessageId(event);
      const targeted = eventMessageId && this.database.prepare(`SELECT 1 FROM messages WHERE ${predicate} AND ${continuation}=? LIMIT 1`).get(eventMessageId);
      const nonLegacy = eventMessageId && this.database.prepare(`SELECT 1 FROM messages WHERE ${predicate} AND ${continuation} IS NOT NULL LIMIT 1`).get();
      const condition = targeted ? ` AND (${continuation}=? OR ${continuation} IS NULL)` : nonLegacy ? ` AND ${continuation} IS NULL` : "";
      let after = 0;
      for (;;) {
      signal?.throwIfAborted();
      const rows = this.database.prepare(`SELECT ordinal,descriptor FROM messages WHERE ${predicate}${condition} AND ordinal>? ORDER BY ordinal LIMIT 64`)
        .all(...(targeted ? [eventMessageId] : []), after) as { ordinal: number; descriptor: string }[];
      if (!rows.length) break;
      const recovery = new ContextCompactionJournalRecoveryService();
      const pending = rows.map(row => JSON.parse(row.descriptor) as NcpMessage);
      recovery.seed(pending); recovery.track(event as never);
      for (const marker of pending) {
        const terminal = recovery.terminalize(marker);
        if (JSON.stringify(terminal) !== JSON.stringify(marker)) await this.applySnapshot(terminal, false);
      }
      after = rows.at(-1)!.ordinal;
      if (rows.length === 64) await (this.database.transactionYield?.() ?? new Promise<void>(resolve => setTimeout(resolve, 0)));
      }
    }
    const payload = event.payload as unknown as Record<string, unknown>;
    const callId = typeof payload.toolCallId === "string" ? payload.toolCallId : undefined;
    const owner = callId ? this.database.prepare("SELECT message_id,part FROM tool_owners WHERE call_id=?").get(callId) as { message_id: string; part: number } | undefined : undefined;
    const messageId = typeof payload.messageId === "string" ? payload.messageId : owner?.message_id ?? this.meta.activeMessageId;
    if (!messageId) return;
    if (event.type === NcpEventType.MessageToolCallResult && event.payload.final === false
      && this.database.prepare("SELECT 1 FROM settled_tools WHERE call_id=?").get(event.payload.toolCallId)) return;
    const row = this.database.prepare("SELECT ordinal,descriptor,bytes FROM messages WHERE id=?").get(messageId) as MessageRow | undefined;
    if (!row && this.meta.total > 0 && !this.meta.activeRunId && !isStreamingMessageCreationEvent(event as never)) return;
    if (row && event.type === NcpEventType.RunError && event.payload.interrupted === true) {
      const inserted = this.database.prepare("SELECT 1 FROM session_interruptions WHERE message_id=?").get(messageId);
      if (!inserted) {
        this.database.prepare("INSERT INTO session_interruptions VALUES (?,?,?)").run(messageId, event.payload.runId ?? null, row.descriptor);
        this.database.prepare("INSERT INTO interruption_fields SELECT * FROM part_fields WHERE message_id=? AND field IN ('state','execution')").run(messageId);
        this.database.prepare("INSERT INTO interruption_chunks SELECT * FROM part_chunks WHERE message_id=? AND field IN ('state','execution')").run(messageId);
      }
    }
    const seed = row ? JSON.parse(row.descriptor) as NcpMessage : null;
    const indices = seed ? [...((seed.metadata?.nextclaw_source as Source | undefined)?.partIndices ?? seed.parts.map((_, index) => index))] : [];
    if (seed && owner && !indices.includes(owner.part)) {
      seed.parts.unshift(this.parts.readPreview(messageId, owner.part));
      indices.unshift(owner.part);
    }
    const before = seed ? structuredClone(seed) : null;
    const replayer = await SessionEventReplayer.create(seed ? [seed] : [], this.meta.activeMessageId, true);
    await replayer.append(event, 0, new Set());
    const updated = replayer.finish().find(message => message.id === messageId);
    if (!updated) return;
    const sourceCount = Number((before?.metadata?.nextclaw_source as Source | undefined)?.partCount ?? before?.parts.length ?? 0);
    while (indices.length < updated.parts.length) indices.push(sourceCount + indices.length - (before?.parts.length ?? 0));
    if (!staged) {
      if (!preserveStaging) this.parts.clearStaging();
      for (const field of ["delta", "args", "content", "contentItems"]) if (payload[field] !== undefined) this.parts.stagePayload(field, payload[field], payloadSource);
    }
    const isTextDelta = event.type === NcpEventType.MessageTextDelta || event.type === NcpEventType.MessageReasoningDelta;
    const isArgsDelta = event.type === NcpEventType.MessageToolCallArgsDelta;
    const sourceField = isTextDelta || isArgsDelta ? "delta" : event.type === NcpEventType.MessageToolCallArgs ? "args" : event.type === NcpEventType.MessageToolCallResult ? "content" : null;
    const targetField = isTextDelta ? "text" : isArgsDelta || event.type === NcpEventType.MessageToolCallArgs ? "args" : "result";
    let extraBytes = 0;
    for (const [index, part] of updated.parts.entries()) {
      const original = before?.parts[index];
      const physical = indices[index]!;
      const previous = original as unknown as Record<string, unknown> | undefined;
      for (const [field, value] of Object.entries(part)) {
        if (value === undefined || (field === targetField && sourceField)) continue;
        if (JSON.stringify(previous?.[field]) !== JSON.stringify(value)) extraBytes += this.parts.writeField(messageId, physical, field, value) + 32;
      }
      const matchesTool = callId && part.type === "tool-invocation" && part.toolCallId === callId;
      if (sourceField && (isTextDelta ? index === updated.parts.length - 1 : matchesTool)) {
        const existingField = this.database.prepare("SELECT bytes FROM part_fields WHERE message_id=? AND part=? AND field=?").get(messageId, physical, targetField) as { bytes: number } | undefined;
        this.parts.promotePayload(messageId, physical, sourceField, targetField, (isTextDelta || isArgsDelta) && Boolean(existingField), payloadSource);
        extraBytes += Number((this.database.prepare("SELECT bytes FROM staged_fields WHERE source=? AND part=-1 AND field=?").get(payloadSource, sourceField) as { bytes: number } | undefined)?.bytes ?? 0) + 32;
        if (event.type === NcpEventType.MessageToolCallResult && payload.contentItems !== undefined) this.parts.promotePayload(messageId, physical, "contentItems", "resultContentItems", false, payloadSource);
      }
      if (part.type === "tool-invocation") this.database.prepare("INSERT OR REPLACE INTO tool_owners VALUES (?,?,?)").run(part.toolCallId, messageId, physical);
      if (matchesTool && event.type === NcpEventType.MessageToolCallResult && event.payload.final !== false) {
        this.database.prepare("INSERT OR REPLACE INTO settled_tools VALUES (?,?,?)").run(callId, messageId, physical);
      }
    }
    this.writeDescriptor(updated, row, Math.max(0, (row?.bytes ?? 0) - Buffer.byteLength(row?.descriptor ?? "")) + extraBytes,
      Math.max(sourceCount, ...indices.map(index => index + 1)));
    if ([NcpEventType.RunFinished, NcpEventType.RunError, NcpEventType.MessageAbort].includes(event.type as NcpEventType)) this.meta.activeRunId = null;
    if (!staged) this.parts.clearStaging(preserveStaging ? payloadSource : undefined);
  };

  private restoreSupersededInterruption = (event: NcpAgentSessionJournalReplayEvent): void => {
    const messageId = readEventMessageId(event);
    const runId = readEventRunId(event);
    for (;;) {
    const rows = this.database.prepare("SELECT message_id,descriptor FROM session_interruptions WHERE message_id=? OR (run_id IS NOT NULL AND run_id=?) LIMIT 64")
      .all(messageId, runId) as { message_id: string; descriptor: string }[];
    if (!rows.length) break;
    for (const row of rows) {
      this.database.prepare("UPDATE messages SET descriptor=? WHERE id=?").run(row.descriptor, row.message_id);
      this.database.prepare(`DELETE FROM part_fields WHERE message_id=? AND field IN ('state','execution')
        AND NOT EXISTS (SELECT 1 FROM settled_tools t WHERE t.message_id=part_fields.message_id AND t.part=part_fields.part)`).run(row.message_id);
      this.database.prepare(`DELETE FROM part_chunks WHERE message_id=? AND field IN ('state','execution')
        AND NOT EXISTS (SELECT 1 FROM settled_tools t WHERE t.message_id=part_chunks.message_id AND t.part=part_chunks.part)`).run(row.message_id);
      this.database.prepare(`INSERT OR REPLACE INTO part_fields SELECT * FROM interruption_fields f WHERE message_id=?
        AND NOT EXISTS (SELECT 1 FROM settled_tools t WHERE t.message_id=f.message_id AND t.part=f.part)`).run(row.message_id);
      this.database.prepare(`INSERT OR REPLACE INTO part_chunks SELECT * FROM interruption_chunks f WHERE message_id=?
        AND NOT EXISTS (SELECT 1 FROM settled_tools t WHERE t.message_id=f.message_id AND t.part=f.part)`).run(row.message_id);
      for (const table of ["session_interruptions", "interruption_fields", "interruption_chunks"]) this.database.prepare(`DELETE FROM ${table} WHERE message_id=?`).run(row.message_id);
      this.meta.activeMessageId = row.message_id;
    }
    }
  };

  applySnapshot = async (message: NcpMessage, staged: boolean): Promise<void> => {
    const row = this.database.prepare("SELECT ordinal,descriptor,bytes FROM messages WHERE id=?").get(message.id) as MessageRow | undefined;
    const old = row ? JSON.parse(row.descriptor) as NcpMessage : null;
    if (old?.role === "assistant" && ["final", "error"].includes(old.status)
      && ["pending", "streaming"].includes(message.status)) return;
    if (message.role === "assistant" && message.metadata?.nextclaw_partial_projection === true) {
      const merged = mergePartialSessionMessage(message, old);
      this.writeDescriptor(merged, row, Math.max(0, row!.bytes - Buffer.byteLength(row!.descriptor)),
        Number((old?.metadata?.nextclaw_source as Source | undefined)?.partCount ?? old?.parts.length ?? 0));
      return;
    }
    await this.parts.retainSettledResults(message.id);
    this.parts.deleteMessage(message.id);
    this.database.prepare("DELETE FROM tool_owners WHERE message_id=?").run(message.id);
    let bytes = 0;
    if (staged) {
      await this.parts.promoteSnapshot(message.id);
      bytes = Number((this.database.prepare("SELECT COALESCE(SUM(bytes+length(field)*3+32),0) AS value FROM part_fields WHERE message_id=?").get(message.id) as { value: number }).value);
    } else for (const [part, value] of message.parts.entries()) bytes += this.parts.writePart(message.id, part, value);
    const count = Number((this.database.prepare("SELECT COALESCE(MAX(part),-1)+1 AS value FROM part_fields WHERE message_id=?").get(message.id) as { value: number }).value);
    // Decode bounded tool identities in SQLite, without reading every tool result or building a JS map.
    const invalid = this.database.prepare("SELECT 1 FROM part_fields WHERE message_id=? AND field='toolCallId' AND bytes>1024 LIMIT 1").get(message.id);
    if (invalid) throw new Error("Tool identity exceeds the supported history cursor budget.");
    this.database.prepare(`INSERT OR REPLACE INTO tool_owners(call_id,message_id,part)
      SELECT json_extract('"'||group_concat(body,'')||'"','$'),message_id,part FROM
      (SELECT message_id,part,chunk,body FROM part_chunks WHERE message_id=? AND field='toolCallId' ORDER BY part,chunk)
      GROUP BY message_id,part`).run(message.id);
    await this.parts.restoreSettledResults(message.id);
    bytes = Number((this.database.prepare("SELECT COALESCE(SUM(bytes+length(field)*3+32),0) AS value FROM part_fields WHERE message_id=?").get(message.id) as { value: number }).value);
    const questionParts = this.database.prepare("SELECT part FROM part_chunks WHERE message_id=? AND field='extensionType' AND chunk=0 AND body='nextclaw.user-question' LIMIT 16").all(message.id) as { part: number }[];
    for (const { part } of questionParts) {
      const data = this.parts.readBoundedField(message.id, part, "data", 64 * 1024) as { questions?: { id?: unknown }[] } | undefined;
      for (const question of data?.questions ?? []) if (typeof question.id === "string") {
        this.database.prepare("INSERT INTO session_questions(id,message_id,asked_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET message_id=excluded.message_id,asked_at=excluded.asked_at").run(question.id, message.id, message.timestamp);
      }
    }
    const questionId = message.metadata?.nextclaw_user_question_id;
    if (message.role === "user" && typeof questionId === "string") this.database.prepare("INSERT INTO session_questions(id,resolution_id) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET resolution_id=COALESCE(session_questions.resolution_id,excluded.resolution_id)").run(questionId, message.id);
    this.writeDescriptor(message, row, bytes, count);
  };

  private writeDescriptor = (message: NcpMessage, existing: MessageRow | undefined, bytes: number, partCount: number): void => {
    if (Buffer.byteLength(message.id) > 1_024) throw new Error("Message identity exceeds the supported history cursor budget.");
    const ordinal = existing?.ordinal ?? ++this.meta.total;
    const revision = randomUUID();
    const recent = this.parts.recentParts(message.id);
    const metadata = { ...message.metadata };
    delete metadata.nextclaw_partial_projection; delete metadata.nextclaw_source;
    const offsets = metadata[MODEL_ROUND_PART_OFFSETS];
    if (Array.isArray(offsets)) metadata[MODEL_ROUND_PART_OFFSETS] = offsets.slice(-64);
    const descriptor = buildSessionMessageDescriptor({ ...message, parts: recent.parts, metadata }, revision);
    descriptor.metadata!.nextclaw_source = { messageId: message.id, revision, ordinal, partCount, partIndices: recent.indices };
    const encoded = JSON.stringify(descriptor);
    if (message.metadata?.nextclaw_timeline_kind === "context_compaction" && Buffer.byteLength(encoded) > 1024 * 1024)
      throw new Error("Checkpoint metadata exceeds the supported bounded protocol size.");
    if (message.metadata?.nextclaw_timeline_kind !== "context_compaction") this.meta.semanticRevision = (this.meta.semanticRevision ?? 0) + 1;
    const totalBytes = bytes + Buffer.byteLength(encoded);
    this.database.prepare("INSERT INTO messages(ordinal,id,descriptor,revision,bytes) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET descriptor=excluded.descriptor,revision=excluded.revision,bytes=excluded.bytes")
      .run(ordinal, message.id, encoded, revision, totalBytes);
    this.meta.dataBytes += totalBytes - (existing?.bytes ?? 0);
    if (message.role === "assistant") {
      if (message.status === "pending" || message.status === "streaming") this.meta.activeMessageId = message.id;
      else if (this.meta.activeMessageId === message.id) this.meta.activeMessageId = null;
    }
    if (message.metadata?.nextclaw_timeline_kind === "context_compaction") {
      const checkpoint = message.metadata.checkpoint as { status?: string };
      this.meta.pendingCompactionMessageIds = this.meta.pendingCompactionMessageIds.filter(id => id !== message.id);
      if (checkpoint.status === "compressing") this.meta.pendingCompactionMessageIds.push(message.id);
      this.meta.pendingCompactionMessageIds = this.meta.pendingCompactionMessageIds.slice(-64);
      if (checkpoint.status === "compressed") this.meta.latestCheckpointMessageId = message.id;
    }
    if (message.role === "user" && typeof message.metadata?.nextclaw_context_recovery_ack === "string") this.meta.latestRecoveryAcknowledgementMessageId = message.id;
  };
}

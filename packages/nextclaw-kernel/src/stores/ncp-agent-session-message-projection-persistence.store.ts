import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { NcpEndpointEvent, NcpMessage } from "@nextclaw/ncp";
import { safeNcpSessionFilename } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import type { NcpAgentSessionJournalReplayEvent } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { NCP_AGENT_SESSION_MESSAGE_PROJECTION_VERSION, type NcpAgentSessionMessageProjectionMeta } from "@kernel/utils/ncp-agent-session-message-projection.utils.js";
import { canCoalesceSessionJournalDeltas, coalesceSessionJournalDeltas, isSessionJournalDelta } from "@kernel/utils/session-journal-delta-coalescer.utils.js";
import { SessionEventProjectionStore } from "./session-event-projection.store.js";
import { SessionMessageSqlProjectionStore, type MessageRow } from "./session-message-sql-projection.store.js";
import { openSqliteDatabase } from "./sqlite-database.store.js";
export type { ReadProjectionPageParams, ReadProjectionMessagesResult } from "./session-message-sql-projection.store.js";

const projectionPath = (directory: string, id: string) => join(directory, ".message-projections", safeNcpSessionFilename(id));
const journalPath = (directory: string, id: string) => join(directory, `${safeNcpSessionFilename(id)}.jsonl`);

/** Local file/SQLite adapter; shared projection semantics live in SessionMessageSqlProjectionStore. */
export class NcpAgentSessionMessageProjectionPersistenceStore extends SessionMessageSqlProjectionStore {
  constructor(private readonly journalDir: string) {
    super({
      database: async (sessionId, create) => {
        const path = projectionPath(journalDir, sessionId);
        if (create) await mkdir(path, { recursive: true });
        else if (!await stat(join(path, "messages.sqlite")).catch(() => null)) return null;
        const database = await openSqliteDatabase(join(path, "messages.sqlite"), { incremental: true });
        database.exec("PRAGMA busy_timeout=50; PRAGMA cache_size=-2048; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
        return database;
      },
      journalBytes: async id => (await stat(journalPath(journalDir, id)).catch(() => null))?.size ?? null,
      journalIdentity: async id => { const value = await stat(journalPath(journalDir, id)).catch(() => null); return value ? `${value.dev}:${value.ino}:${value.birthtimeMs}` : null; },
      delete: id => rm(projectionPath(journalDir, id), { recursive: true, force: true }),
      transaction: async () => { throw new Error("Local journal preparation uses the native file transaction adapter."); },
    });
  }
  prepare = async (sessionId: string, signal?: AbortSignal, onProgress?: (bytes: number, total: number) => void): Promise<void> => {
    const { stat } = await import("node:fs/promises");
    const { scanBoundedSessionJournal } = await import("@kernel/utils/session-journal-stream.utils.js");
    const { recoverSessionJournalTornTail } = await import("./session-journal-maintenance.store.js");
    await recoverSessionJournalTornTail(this.journalPath(sessionId), signal);
    const journalBytes = (await stat(this.journalPath(sessionId))).size;
    const journalIdentity = (await this.journalIdentity(sessionId))!;
    const database = (await this.database(sessionId, true))!;
    let meta = this.meta(database, sessionId, true);
    if (!meta || meta.projectedJournalOffset > journalBytes || meta.journalIdentity !== journalIdentity) {
      database.exec("DELETE FROM messages; DELETE FROM tool_owners; DELETE FROM part_fields; DELETE FROM part_chunks; DELETE FROM part_previews; DELETE FROM settled_tools; DELETE FROM session_questions; DELETE FROM session_interruptions; DELETE FROM interruption_fields; DELETE FROM interruption_chunks;");
      meta = {
      version: NCP_AGENT_SESSION_MESSAGE_PROJECTION_VERSION, sessionId, total: 0,
      dataBytes: 0, projectedJournalOffset: 0, nextSeq: 1, contextWindow: null,
      activeMessageId: null, pendingCompactionMessageIds: [],
      journalIdentity,
      };
    }
    const projector = new SessionEventProjectionStore(database, meta);
    projector.parts.omitSmallDeltaStaging = true;
    let pendingDelta: { event: Parameters<typeof coalesceSessionJournalDeltas>[0]; boundary: number; nextSeq: number; timestamp?: string } | null = null;
    const flushDelta = async (): Promise<void> => {
      if (!pendingDelta) return;
      await projector.apply(pendingDelta.event, false, signal, true, pendingDelta.timestamp);
      meta!.projectedJournalOffset = pendingDelta.boundary;
      meta!.nextSeq = Math.max(meta!.nextSeq ?? 1, pendingDelta.nextSeq);
      pendingDelta = null;
    };
    let transaction = false;
    let lastCommit = performance.now();
    const commitIfDue = async (): Promise<void> => {
      if (performance.now() - lastCommit < 50) return;
      await flushDelta();
      this.writeMeta(database, meta!); database.exec("COMMIT"); transaction = false;
      signal?.throwIfAborted();
      await new Promise<void>(resolve => setImmediate(resolve));
      database.exec("BEGIN IMMEDIATE"); transaction = true; lastCommit = performance.now();
    };
    try {
      meta.preparation = { status: "preparing", journalBytes };
      this.writeMeta(database, meta);
      database.exec("BEGIN IMMEDIATE"); transaction = true;
      projector.parts.clearStaging();
      await scanBoundedSessionJournal({
        path: this.journalPath(sessionId), startOffset: meta.projectedJournalOffset, endOffset: journalBytes, signal,
        onToken: (token, path) => projector.parts.captureToken(token, path),
        onProgress: bytes => onProgress?.(Math.min(bytes, journalBytes), journalBytes),
        onEntry: async (entry, boundary, _index, truncated) => {
          this.assertSupportedEntry(entry);
          if (entry._type === "metadata") meta!.legacyMetadata = {
            metadata: entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata) ? entry.metadata as Record<string, unknown> : {},
            ...(typeof entry.agent_id === "string" ? { agentId: entry.agent_id } : {}),
            createdAt: typeof entry.created_at === "string" ? entry.created_at : new Date(0).toISOString(),
            updatedAt: typeof entry.updated_at === "string" ? entry.updated_at : new Date(0).toISOString(),
          };
          const event = entry.event as NcpAgentSessionJournalReplayEvent | undefined;
          const endpoint = event as NcpEndpointEvent | undefined;
          if (!truncated && endpoint && isSessionJournalDelta(endpoint) && Buffer.byteLength(endpoint.payload.delta) <= 2_048) {
            if (pendingDelta && (!canCoalesceSessionJournalDeltas(pendingDelta.event, endpoint)
              || Buffer.byteLength(pendingDelta.event.payload.delta) + Buffer.byteLength(endpoint.payload.delta) > 16 * 1024)) await flushDelta();
            pendingDelta = { event: pendingDelta ? coalesceSessionJournalDeltas(pendingDelta.event, endpoint) : endpoint,
              boundary, nextSeq: Math.max(pendingDelta?.nextSeq ?? 1, Number(entry.seq ?? 0) + 1),
              timestamp: pendingDelta?.timestamp ?? (typeof entry.timestamp === "string" ? entry.timestamp : undefined) };
            projector.parts.clearStaging();
            onProgress?.(boundary, journalBytes);
            await commitIfDue();
            return;
          }
          await flushDelta();
          if (entry._type === "event" && event?.type) {
            await projector.apply(event, true, signal, false, typeof entry.timestamp === "string" ? entry.timestamp : undefined);
            meta.nextSeq = Math.max(meta.nextSeq ?? 1, Number(entry.seq ?? 0) + 1);
          }
          await projector.parts.clearStagingBounded(signal);
          meta.projectedJournalOffset = boundary;
          onProgress?.(boundary, journalBytes);
          await commitIfDue();
        },
      });
      await flushDelta();
      signal?.throwIfAborted();
      meta.preparation = { status: "ready", journalBytes };
      meta.projectedJournalOffset = journalBytes;
      this.writeMeta(database, meta);
      database.exec("COMMIT"); transaction = false;
    } catch (error) {
      if (transaction) database.exec("ROLLBACK");
      throw error;
    } finally { database.close(); }
  };

  protected override readJournalTailMessages = async (sessionId: string, meta: NcpAgentSessionMessageProjectionMeta): Promise<NcpMessage[]> => {
    const { readNcpAgentSessionProjectionTail } = await import("./ncp-agent-session-message-projection-tail.store.js");
    return readNcpAgentSessionProjectionTail(this.journalPath(sessionId), meta,
      async messageId => {
        const database = await this.database(sessionId);
        if (!database) return null;
        try {
          const row = database.prepare("SELECT ordinal,id,descriptor,revision,bytes FROM messages WHERE id=?").get(messageId) as MessageRow | undefined;
          return row ? this.assemble(database, row) : null;
        } finally { database.close(); }
      }, async callId => {
        const database = await this.database(sessionId);
        if (!database) return null;
        try { return (database.prepare("SELECT message_id FROM tool_owners WHERE call_id=?").get(callId) as { message_id: string } | undefined)?.message_id ?? null; }
        finally { database.close(); }
      });
  };

  private journalPath = (sessionId: string) => journalPath(this.journalDir, sessionId);
}

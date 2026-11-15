import { open } from "node:fs/promises";
import { NcpEventType } from "@nextclaw/ncp";
import type { NcpAgentSessionJournalEventEntry } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { sessionJsonChunks } from "@kernel/utils/session-message-chunks.utils.js";
import { assertSessionJournalTailComplete } from "./session-journal-maintenance.store.js";

async function rollbackAppend(file: Awaited<ReturnType<typeof open>> | undefined, previousOffset: number | undefined, error: unknown) {
  const cleanupErrors: unknown[] = [];
  let rollback = "not-needed";
  if (file && previousOffset !== undefined) {
    try { await file.truncate(previousOffset); await file.sync(); rollback = "succeeded"; }
    catch (rollbackError) { rollback = "failed"; cleanupErrors.push(rollbackError); }
  }
  if (file) {
    try { await file.close(); }
    catch (closeError) { cleanupErrors.push(closeError); }
  }
  return { rollback, cause: cleanupErrors.length
    ? new AggregateError([error, ...cleanupErrors], "Journal append and cleanup failed", { cause: error })
    : error };
}

async function createAppendFailure(error: unknown, transaction: {
  file?: Awaited<ReturnType<typeof open>>; previousOffset?: number; offset: number;
  path: string; stage: string; seq: number; signal?: AbortSignal;
}) {
  const { file, previousOffset, offset, path, stage, seq, signal } = transaction;
  const { rollback, cause } = await rollbackAppend(file, previousOffset, error);
  const cancelled = signal?.aborted && error === signal.reason;
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const detail = error instanceof Error ? error.message : String(error);
  return Object.assign(new Error(`Session journal ${stage} failed: ${detail}`, { cause }), {
    name: cancelled && rollback !== "failed" ? "AbortError" : "SessionJournalAppendError",
    ...(typeof code === "string" || typeof code === "number" ? { code } : {}),
    journalCommitRejected: rollback !== "failed", journalWriteFailed: !cancelled || rollback === "failed",
    sessionPersistence: { operation: "journal.append", stage, path, seq, rollback, journalCommitted: false,
      ...(previousOffset === undefined ? {} : { previousOffset, journalOffset: offset }) },
  });
}

/** Own the canonical file transaction; derived indexes are outside this commit boundary. */
export async function appendSessionJournalEntry(path: string, entry: NcpAgentSessionJournalEventEntry, signal?: AbortSignal): Promise<{ previousOffset: number; offset: number }> {
  let stage = "validate-tail";
  let file: Awaited<ReturnType<typeof open>> | undefined;
  let previousOffset: number | undefined;
  let offset = 0;
  try {
    signal?.throwIfAborted();
    await assertSessionJournalTailComplete(path);
    stage = "open";
    file = await open(path, "a");
    stage = "stat";
    previousOffset = (await file.stat()).size;
    offset = previousOffset;
    const write = async (text: string) => {
      stage = "write";
      const buffer = Buffer.from(text);
      let position = 0;
      while (position < buffer.length) {
        const result = await file!.write(buffer, position, buffer.length - position, null);
        if (!result.bytesWritten) throw new Error("Session journal append made no progress.");
        position += result.bytesWritten;
        offset += result.bytesWritten;
      }
    };
    stage = "serialize";
    for (const chunk of sessionJsonChunks(entry)) { await write(chunk); stage = "serialize"; }
    await write("\n");
    stage = "cancel-check";
    signal?.throwIfAborted();
    const event = entry.event;
    if (event.type === NcpEventType.MessageSent && event.payload.message.metadata?.nextclaw_timeline_kind === "context_compaction"
      && (event.payload.message.metadata.checkpoint as { status?: string } | undefined)?.status === "compressed") {
      stage = "sync";
      await file.sync();
    }
    stage = "close";
    await file.close();
    file = undefined;
    return { previousOffset, offset };
  } catch (error) {
    throw await createAppendFailure(error, { file, previousOffset, offset, path, stage, seq: entry.seq, signal });
  }
}

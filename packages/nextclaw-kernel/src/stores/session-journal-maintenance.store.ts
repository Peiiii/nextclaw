import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
import { copyFile, open, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { join } from "node:path";
import type { NcpEndpointEvent } from "@nextclaw/ncp";
import {
  NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
  normalizeNcpSessionId,
  safeNcpSessionFilename,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";
import {
  canCoalesceSessionJournalDeltas,
  coalesceSessionJournalDeltas,
  isSessionJournalDelta,
  SESSION_JOURNAL_DELTA_MAX_BYTES,
} from "@kernel/utils/session-journal-delta-coalescer.utils.js";
import { NcpAgentSessionMetadataStore } from "./ncp-agent-session-metadata.store.js";
import { SessionJournalLoaderStore } from "./session-journal-loader.store.js";
import { openSqliteDatabase, runSqliteTransaction } from "./sqlite-database.store.js";

type JournalEntry = {
  _type: string;
  version?: number;
  seq?: number;
  timestamp?: string;
  event?: NcpEndpointEvent;
};

export type SessionJournalCompactionResult = {
  sessionId: string;
  applied: boolean;
  inputBytes: number;
  outputBytes: number;
  inputLines: number;
  outputLines: number;
};

const CATALOG_FILE = ".ncp-agent-session-catalog.sqlite";

function paths(journalDir: string, sessionId: string) {
  const basename = safeNcpSessionFilename(sessionId.replace(/:/g, "_"));
  const source = join(journalDir, `${basename}.jsonl`);
  return {
    source,
    backup: `${source}.backup`,
    pending: `${source}.pending`,
    marker: `${source}.maintenance`,
    markerDraft: `${source}.maintenance.tmp`,
    projection: join(journalDir, ".message-projections", basename),
  };
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

async function syncFile(path: string): Promise<void> {
  const handle = await open(path, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function assertSourceUnchanged(source: string, expected: Awaited<ReturnType<typeof stat>>): Promise<void> {
  const current = await stat(source);
  if (current.size !== expected.size || current.mtimeMs !== expected.mtimeMs || current.ino !== expected.ino)
    throw new Error("Journal changed during compaction; refusing activation.");
}

/** Refuse to append after a partial write: another JSONL entry would hide the torn tail. */
export async function assertSessionJournalTailComplete(source: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>>;
  try { handle = await open(source, "r"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  try {
    const size = (await handle.stat()).size;
    if (size === 0) return;
    const suffix = Buffer.alloc(1);
    await handle.read(suffix, 0, 1, size - 1);
    if (suffix[0] !== 10) throw new Error("Journal has an incomplete tail line; refusing further writes.");
  } finally { await handle.close(); }
}

async function invalidateDerivedState(journalDir: string, sessionId: string, projection: string): Promise<void> {
  await rm(projection, { recursive: true, force: true });
  const catalogPath = join(journalDir, CATALOG_FILE);
  try { await stat(catalogPath); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const database = await openSqliteDatabase(catalogPath);
  try {
    database.exec("PRAGMA busy_timeout = 10000; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;");
    runSqliteTransaction(database, () => {
      database.prepare("DELETE FROM run_recovery WHERE session_id = ?").run(sessionId);
      database.prepare("DELETE FROM sessions WHERE session_id = ? AND deleted_at IS NULL").run(sessionId);
    }, "IMMEDIATE");
  } finally { database.close(); }
  await syncDirectory(journalDir);
}

/** Runs before the catalog opens. An interrupted switch always rolls back to the untouched backup. */
export async function recoverSessionJournalMaintenance(journalDir: string): Promise<void> {
  let names: string[];
  try { names = await readdir(journalDir); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const name of names.filter((item) => item.endsWith(".jsonl.maintenance"))) {
    const marker = JSON.parse(await readFile(join(journalDir, name), "utf8")) as { sessionId?: string };
    const sessionId = normalizeNcpSessionId(marker.sessionId ?? "");
    if (!sessionId || `${safeNcpSessionFilename(sessionId.replace(/:/g, "_"))}.jsonl.maintenance` !== name)
      throw new Error(`Invalid journal maintenance marker: ${name}`);
    const source = join(journalDir, name.slice(0, -".maintenance".length));
    const backup = `${source}.backup`;
    const restore = `${source}.restore`;
    await copyFile(backup, restore);
    await syncFile(restore);
    await rename(restore, source);
    const basename = name.slice(0, -".jsonl.maintenance".length);
    await invalidateDerivedState(journalDir, sessionId, join(journalDir, ".message-projections", basename));
    await rm(`${source}.pending`, { force: true });
    await rm(join(journalDir, name));
    await syncDirectory(journalDir);
  }
}

async function validateColdReplay(journalDir: string, sessionId: string, source: string, candidate: string): Promise<void> {
  const loader = new SessionJournalLoaderStore(
    new NcpAgentSessionMetadataStore(journalDir),
    { readAllSnapshot: async () => null },
  );
  const original = await loader.load(sessionId, source);
  const compacted = await loader.load(sessionId, candidate);
  if (!original || !compacted || !isDeepStrictEqual(original.record.messages, compacted.record.messages)) {
    throw new Error("Session journal compaction changed cold-replayed messages.");
  }
}

async function writeCoalescedJournal(source: string, pending: string): Promise<{ inputLines: number; outputLines: number }> {
  const output = await open(pending, "wx");
  let inputLines = 0;
  let outputLines = 0;
  let nextSeq = 1;
  let pendingEntry: JournalEntry | null = null;
  const flush = async () => {
    if (!pendingEntry) return;
    if (pendingEntry._type === "event") pendingEntry.seq = nextSeq++;
    await output.writeFile(`${JSON.stringify(pendingEntry)}\n`);
    outputLines++;
    pendingEntry = null;
  };
  try {
    const lines = createInterface({ input: createReadStream(source), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line) throw new Error("Journal contains a blank line; compaction requires a valid complete source.");
      inputLines++;
      const entry = JSON.parse(line) as JournalEntry;
      if (!entry || typeof entry !== "object" || !["event", "metadata"].includes(entry._type)) {
        throw new Error(`Invalid journal entry at line ${inputLines}.`);
      }
      if (entry.version !== undefined && entry.version !== NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION)
        throw new Error(`Unsupported journal entry version at line ${inputLines}.`);
      if (entry._type === "event") {
        if (!Number.isSafeInteger(entry.seq) || entry.seq! < 1 || !entry.event?.type || !("payload" in entry.event)) {
          throw new Error(`Invalid journal sequence or event at line ${inputLines}.`);
        }
      }
      if (pendingEntry?._type === "event" && entry._type === "event" && pendingEntry.event && entry.event &&
        canCoalesceSessionJournalDeltas(pendingEntry.event, entry.event) &&
        isSessionJournalDelta(pendingEntry.event) && isSessionJournalDelta(entry.event)) {
        const merged = coalesceSessionJournalDeltas(pendingEntry.event, entry.event);
        if (Buffer.byteLength(merged.payload.delta, "utf8") <= SESSION_JOURNAL_DELTA_MAX_BYTES) {
          pendingEntry.event = merged;
          continue;
        }
      }
      await flush();
      pendingEntry = entry;
    }
    await flush();
    await output.sync();
  } finally {
    await output.close();
  }
  return { inputLines, outputLines };
}

async function writeMaintenanceMarker(journalDir: string, target: ReturnType<typeof paths>, sessionId: string): Promise<void> {
  const marker = await open(target.markerDraft, "wx");
  try {
    await marker.writeFile(`${JSON.stringify({ sessionId })}\n`);
    await marker.sync();
  } finally {
    await marker.close();
  }
  await rename(target.markerDraft, target.marker);
  await syncDirectory(journalDir);
}

async function activateCompactedJournal(
  journalDir: string,
  sessionId: string,
  target: ReturnType<typeof paths>,
  sourceStat: Awaited<ReturnType<typeof stat>>,
): Promise<void> {
  let renamed = false;
  try {
    await copyFile(target.source, target.backup, constants.COPYFILE_EXCL);
    await syncFile(target.backup);
    await assertSourceUnchanged(target.source, sourceStat);
    await writeMaintenanceMarker(journalDir, target, sessionId);
    await assertSourceUnchanged(target.source, sourceStat);
    await rename(target.pending, target.source);
    renamed = true;
    await syncDirectory(journalDir);
    await invalidateDerivedState(journalDir, sessionId, target.projection);
    await rm(target.marker);
    await syncDirectory(journalDir);
  } catch (error) {
    if (renamed) await recoverSessionJournalMaintenance(journalDir);
    else {
      await rm(target.markerDraft, { force: true });
      await rm(target.marker, { force: true });
      await rm(target.backup, { force: true });
    }
    throw error;
  }
}

/** Restores the original v1 journal after a successful offline compaction. All writers must be stopped. */
export async function restoreSessionJournalBackup(input: {
  journalDir: string;
  sessionId: string;
  writersStopped?: true;
}): Promise<{ sessionId: string; restored: true }> {
  const sessionId = normalizeNcpSessionId(input.sessionId);
  if (!sessionId || input.writersStopped !== true)
    throw new Error("Stop all writers and explicitly acknowledge it before restoring a journal backup.");
  const target = paths(input.journalDir, sessionId);
  await stat(target.backup);
  for (const candidate of [target.pending, target.marker, target.markerDraft]) {
    try { await stat(candidate); throw new Error(`Unresolved journal maintenance file: ${candidate}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  const sourceStat = await stat(target.source);
  let recoveryStarted = false;
  try {
    await writeCoalescedJournal(target.backup, target.pending);
    const expected = await stat(target.pending);
    if (sourceStat.size !== expected.size || await hashFile(target.source) !== await hashFile(target.pending))
      throw new Error("Journal changed since compaction; refusing restore to protect later events.");
    await assertSourceUnchanged(target.source, sourceStat);
    await writeMaintenanceMarker(input.journalDir, target, sessionId);
    await assertSourceUnchanged(target.source, sourceStat);
    recoveryStarted = true;
    await recoverSessionJournalMaintenance(input.journalDir);
  } catch (error) {
    await rm(target.markerDraft, { force: true });
    if (!recoveryStarted) await rm(target.marker, { force: true });
    throw error;
  } finally {
    await rm(target.pending, { force: true });
  }
  return { sessionId, restored: true };
}

/** Explicit offline operation. The caller must stop every writer for this HOME before apply. */
export async function compactSessionJournal(input: {
  journalDir: string;
  sessionId: string;
  apply: boolean;
  writersStopped?: true;
}): Promise<SessionJournalCompactionResult> {
  const sessionId = normalizeNcpSessionId(input.sessionId);
  if (!sessionId) throw new Error("A session ID is required.");
  if (input.apply && input.writersStopped !== true) throw new Error("Stop all writers and explicitly acknowledge it before applying compaction.");
  const target = paths(input.journalDir, sessionId);
  for (const candidate of [target.backup, target.pending, target.marker, target.markerDraft]) {
    try { await stat(candidate); throw new Error(`Unresolved journal maintenance file: ${candidate}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  const before = await stat(target.source);
  await assertSessionJournalTailComplete(target.source);
  try {
    const { inputLines, outputLines } = await writeCoalescedJournal(target.source, target.pending);
    await validateColdReplay(input.journalDir, sessionId, target.source, target.pending);
    await assertSourceUnchanged(target.source, before);
    const outputBytes = (await stat(target.pending)).size;
    const result = { sessionId, applied: input.apply, inputBytes: before.size, outputBytes, inputLines, outputLines };
    if (!input.apply) return result;
    await activateCompactedJournal(input.journalDir, sessionId, target, before);
    return result;
  } finally {
    await rm(target.pending, { force: true });
  }
}

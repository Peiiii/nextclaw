import { copyFile, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import { NcpAgentSessionJournalStore } from "./ncp-agent-session-journal.store.js";
import { compactSessionJournal, restoreSessionJournalBackup } from "./session-journal-maintenance.store.js";

const sessionId = "session-maintenance";
let journalDir: string | null = null;

afterEach(async () => {
  if (journalDir) await rm(journalDir, { recursive: true, force: true });
  journalDir = null;
});

async function seedClosedJournal(directory: string): Promise<void> {
  const store = new NcpAgentSessionJournalStore(directory);
  await store.appendSessionEvent({ sessionId, event: {
    type: NcpEventType.RunStarted,
    payload: { sessionId, runId: "run-1", messageId: "assistant-1", startedAt: "2026-09-29T00:00:00.000Z" },
  } });
  await store.appendSessionEvent({ sessionId, event: {
    type: NcpEventType.MessageReasoningStart, payload: { sessionId, messageId: "assistant-1" },
  } });
  for (let index = 0; index < 40; index++) {
    await store.appendSessionEvent({ sessionId, event: {
      type: NcpEventType.MessageReasoningDelta,
      payload: { sessionId, messageId: "assistant-1", delta: "思" },
    } });
  }
  await store.appendSessionEvent({ sessionId, event: {
    type: NcpEventType.MessageReasoningEnd, payload: { sessionId, messageId: "assistant-1" },
  } });
  await store.appendSessionEvent({ sessionId, event: {
    type: NcpEventType.MessageCompleted,
    payload: { sessionId, message: {
      id: "assistant-1", sessionId, role: "assistant", status: "final",
      parts: [{ type: "reasoning", text: "思".repeat(40) }],
      timestamp: "2026-09-29T00:00:01.000Z",
    } },
  } });
  await store.appendSessionEvent({ sessionId, event: {
    type: NcpEventType.RunFinished,
    payload: { sessionId, runId: "run-1", messageId: "assistant-1", endedAt: "2026-09-29T00:00:02.000Z" },
  } });
  store.close();
}

describe("offline session journal maintenance", () => {
  it("dry-runs, then atomically replaces a closed journal after cold replay parity", async () => {
    journalDir = await mkdtemp(join(tmpdir(), "nextclaw-journal-maintenance-"));
    await seedClosedJournal(journalDir);
    const other = new NcpAgentSessionJournalStore(journalDir);
    await other.appendSessionEvent({ sessionId: "deleted-session", event: {
      type: NcpEventType.MessageSent,
      payload: { sessionId: "deleted-session", message: {
        id: "deleted-message", sessionId: "deleted-session", role: "user", status: "final",
        parts: [{ type: "text", text: "deleted" }], timestamp: "2026-09-29T00:00:00.000Z",
      } },
    } });
    const deletedPath = join(journalDir, "deleted-session.jsonl");
    const deletedSource = await readFile(deletedPath);
    await other.deleteSession("deleted-session");
    await writeFile(deletedPath, deletedSource);
    other.close();
    const source = join(journalDir, `${sessionId}.jsonl`);
    const original = await readFile(source);
    const baseline = await new NcpAgentSessionJournalStore(journalDir).getSession(sessionId);
    const preview = await compactSessionJournal({ journalDir, sessionId, apply: false });
    expect(preview.inputLines - preview.outputLines).toBe(39);
    expect(preview.outputBytes).toBeLessThan(preview.inputBytes / 2);
    expect(await readFile(source)).toEqual(original);
    await expect(compactSessionJournal({ journalDir, sessionId, apply: true })).rejects.toThrow("Stop all writers");

    const result = await compactSessionJournal({ journalDir, sessionId, apply: true, writersStopped: true });
    expect(result.applied).toBe(true);
    expect(await readFile(`${source}.backup`)).toEqual(original);
    const cold = new NcpAgentSessionJournalStore(journalDir);
    await cold.initialize();
    expect((await cold.getSession(sessionId))?.messages).toEqual(baseline?.messages);
    expect(await cold.listSessionMessagePage({ sessionId, limit: 10 })).toMatchObject({ total: 1 });
    expect((await cold.listSessionSummaries()).map(({ sessionId: id }) => id)).not.toContain("deleted-session");
    cold.close();

    await expect(restoreSessionJournalBackup({ journalDir, sessionId })).rejects.toThrow("Stop all writers");
    await restoreSessionJournalBackup({ journalDir, sessionId, writersStopped: true });
    expect(await readFile(source)).toEqual(original);
    const restored = new NcpAgentSessionJournalStore(journalDir);
    await restored.initialize();
    expect((await restored.getSession(sessionId))?.messages).toEqual(baseline?.messages);
    restored.close();
  });

  it("restores the backup before opening the catalog after an interrupted switch", async () => {
    journalDir = await mkdtemp(join(tmpdir(), "nextclaw-journal-maintenance-"));
    await seedClosedJournal(journalDir);
    const source = join(journalDir, `${sessionId}.jsonl`);
    const original = await readFile(source);
    await copyFile(source, `${source}.backup`);
    await writeFile(source, "incomplete candidate");
    await writeFile(`${source}.maintenance`, `${JSON.stringify({ sessionId })}\n`);
    const cold = new NcpAgentSessionJournalStore(journalDir);
    await cold.initialize();
    expect(await readFile(source)).toEqual(original);
    await expect(stat(`${source}.maintenance`)).rejects.toMatchObject({ code: "ENOENT" });
    cold.close();
  });

  it("refuses backup restore after the compacted session gains new events", async () => {
    journalDir = await mkdtemp(join(tmpdir(), "nextclaw-journal-maintenance-"));
    await seedClosedJournal(journalDir);
    await compactSessionJournal({ journalDir, sessionId, apply: true, writersStopped: true });
    const store = new NcpAgentSessionJournalStore(journalDir);
    await store.initialize();
    await store.appendSessionEvent({ sessionId, event: {
      type: NcpEventType.MessageSent,
      payload: { sessionId, message: {
        id: "new-user", sessionId, role: "user", status: "final",
        parts: [{ type: "text", text: "after compaction" }], timestamp: "2026-09-29T00:00:03.000Z",
      } },
    } });
    store.close();
    const source = join(journalDir, `${sessionId}.jsonl`);
    const changed = await readFile(source);
    await expect(restoreSessionJournalBackup({ journalDir, sessionId, writersStopped: true }))
      .rejects.toThrow("protect later events");
    expect(await readFile(source)).toEqual(changed);
    await expect(stat(`${source}.maintenance`)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses a torn tail without creating an activation marker or backup", async () => {
    journalDir = await mkdtemp(join(tmpdir(), "nextclaw-journal-maintenance-"));
    await seedClosedJournal(journalDir);
    const source = join(journalDir, `${sessionId}.jsonl`);
    await writeFile(source, `${await readFile(source, "utf8")}{"_type":"event"`);
    const original = await readFile(source);
    await expect(compactSessionJournal({ journalDir, sessionId, apply: true, writersStopped: true }))
      .rejects.toThrow("incomplete tail line");
    expect(await readFile(source)).toEqual(original);
    await expect(stat(`${source}.backup`)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(`${source}.maintenance`)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses to append after a torn journal tail across restart", async () => {
    journalDir = await mkdtemp(join(tmpdir(), "nextclaw-journal-maintenance-"));
    await seedClosedJournal(journalDir);
    const journalPath = join(journalDir, `${sessionId}.jsonl`);
    const torn = `${await readFile(journalPath, "utf8")}{"_type":"event"`;
    await writeFile(journalPath, torn);

    const restarted = new NcpAgentSessionJournalStore(journalDir);
    await restarted.initialize();
    await expect(restarted.appendSessionEvent({
      sessionId,
      event: { type: NcpEventType.MessageTextDelta, payload: { sessionId, messageId: "assistant-1", delta: "x" } },
    })).rejects.toThrow("incomplete tail line");
    expect(await readFile(journalPath, "utf8")).toBe(torn);
    restarted.close();
  });
});

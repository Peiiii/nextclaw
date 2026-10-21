import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { NcpAgentSessionMessageProjectionStore } from "./ncp-agent-session-message-projection.store.js";
import type { NcpAgentSessionMessageProjectionPersistenceStore } from "./ncp-agent-session-message-projection-persistence.store.js";
import { SessionMessagePreparationStore } from "./session-message-preparation.store.js";

const sessionId = "session-1";
const directories: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
const message = (id: string, text = id): NcpMessage => ({ id, sessionId, role: "user", status: "final", timestamp: "2026-10-19T00:00:00.000Z", parts: [{ type: "text", text }] });
const persistence = (store: NcpAgentSessionMessageProjectionStore) => (store as unknown as { persistence: NcpAgentSessionMessageProjectionPersistenceStore }).persistence;
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "projection-recovery-")); directories.push(directory);
  const raw = `${JSON.stringify({ _type: "event", version: 1, seq: 1, timestamp: "2026-10-19T00:00:00.000Z", event: { type: NcpEventType.MessageSent, payload: { sessionId, message: message("original") } } })}\n`;
  await writeFile(join(directory, `${sessionId}.jsonl`), raw);
  return { directory, raw, store: new NcpAgentSessionMessageProjectionStore(directory) };
}

describe("transactional derived projection recovery", () => {
  it("leaves the prior committed body and metadata intact when rebuilding fails", async () => {
    const { store } = await fixture();
    await store.prepare(sessionId, { wait: true });
    const writer = persistence(store) as unknown as { writeMeta: (...args: unknown[]) => void };
    const failure = vi.spyOn(writer, "writeMeta").mockImplementationOnce(() => { throw new Error("disk write failed"); });
    await expect(store.rebuild({ sessionId, messages: [message("replacement")], projectedJournalOffset: 999 })).rejects.toThrow("disk write failed");
    failure.mockRestore();
    expect((await store.readPage({ sessionId, limit: 20 }))?.messages.map(item => item.id)).toEqual(["original"]);
  });

  it("rolls back a failed synchronization including the old fragment revision", async () => {
    const { store } = await fixture(); await store.prepare(sessionId, { wait: true });
    const before = await store.readPart(sessionId, "original", 0);
    const writer = persistence(store) as unknown as { writeMeta: (...args: unknown[]) => void };
    const failure = vi.spyOn(writer, "writeMeta").mockImplementationOnce(() => { throw new Error("commit unavailable"); });
    await expect(store.synchronize({ sessionId, messages: [message("original", "changed")], projectedJournalOffset: 999 })).rejects.toThrow("commit unavailable");
    failure.mockRestore();
    expect(await store.readPart(sessionId, "original", 0)).toEqual(before);
  });

  it("keeps ordinary reads pure and prepares a missing legacy index explicitly", async () => {
    const { store } = await fixture();
    const prepare = vi.spyOn(persistence(store), "prepare");
    expect(await store.listPage({ sessionId, limit: 20 })).toBeNull();
    expect(prepare).not.toHaveBeenCalled();
    expect((await store.prepare(sessionId))?.status).toMatch(/queued|preparing/);
    await store.prepare(sessionId, { wait: true });
    expect((await store.listPage({ sessionId, limit: 20 }))?.messages[0]?.id).toBe("original");
  });

  it("repairs a corrupt derived database while preserving the raw journal byte for byte", async () => {
    const { directory, store, raw } = await fixture(); await store.prepare(sessionId, { wait: true });
    await writeFile(join(directory, ".message-projections", sessionId, "messages.sqlite"), "not a database");
    const cold = new NcpAgentSessionMessageProjectionStore(directory);
    await cold.prepare(sessionId, { wait: true });
    expect((await cold.listPage({ sessionId, limit: 1 }))?.messages[0]?.id).toBe("original");
    expect(await readFile(join(directory, `${sessionId}.jsonl`), "utf8")).toBe(raw);
  });

  it("rejects fragments from another message, session or obsolete revision", async () => {
    const { store } = await fixture(); await store.prepare(sessionId, { wait: true });
    await store.synchronize({ sessionId, messages: [message("original", "x".repeat(64 * 1024))], projectedJournalOffset: 1 });
    const first = await store.readPart(sessionId, "original", 0);
    expect(first?.nextCursor).toBeTruthy();
    await store.synchronize({ sessionId, messages: [message("original", "new source")], projectedJournalOffset: 999 });
    await expect(store.readPart(sessionId, "original", 0, first!.nextCursor!)).rejects.toThrow("stale");
    await expect(store.readPart(sessionId, "original", 1, first!.nextCursor!)).rejects.toThrow("stale");
  });

  it("runs only one maintenance task globally and supports queued cancellation", async () => {
    let active = 0; let maximum = 0;
    const release: (() => void)[] = [];
    const operation = async () => { active++; maximum = Math.max(maximum, active); await new Promise<void>(resolve => release.push(resolve)); active--; };
    const a = new SessionMessagePreparationStore(operation); const b = new SessionMessagePreparationStore(operation);
    a.start("a", 10); b.start("b", 10);
    await new Promise(resolve => setImmediate(resolve));
    expect(maximum).toBe(1); expect(b.cancel("b")).toBe(true);
    release[0]!(); await a.wait("a");
    await expect(b.wait("b")).rejects.toThrow("cancelled");
    expect(maximum).toBe(1);
  });
});

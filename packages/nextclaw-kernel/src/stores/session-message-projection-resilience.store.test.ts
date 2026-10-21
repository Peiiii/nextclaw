import { mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import type { NcpAgentSessionJournalReplayEvent } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { replayNcpAgentSessionEvents } from "@kernel/utils/ncp-agent-session-replay.utils.js";
import { NcpAgentSessionMessageProjectionPersistenceStore } from "./ncp-agent-session-message-projection-persistence.store.js";
import { SessionMessageSqlProjectionStore } from "./session-message-sql-projection.store.js";
import { openSqliteDatabase, type SqliteDatabase } from "./sqlite-database.store.js";

const sessionId = "resilience-session";
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
const message = (id: string, parts: NcpMessage["parts"], status: NcpMessage["status"] = "streaming"): NcpMessage => ({
  id, sessionId, role: "assistant", status, parts, timestamp: "2026-10-19T00:00:00.000Z",
});
const sent = (value: NcpMessage): NcpAgentSessionJournalReplayEvent => ({ type: NcpEventType.MessageSent, payload: { sessionId, message: value } });
async function fixture(events: NcpAgentSessionJournalReplayEvent[]) {
  const directory = await mkdtemp(join(tmpdir(), "indexed-session-")); directories.push(directory);
  const raw = events.map((event, index) => JSON.stringify({ _type: "event", version: 1, seq: index + 1, timestamp: "2026-10-19T00:00:00.000Z", event }) + "\n").join("");
  await writeFile(join(directory, `${sessionId}.jsonl`), raw);
  return { directory, store: new NcpAgentSessionMessageProjectionPersistenceStore(directory), bytes: Buffer.byteLength(raw) };
}

describe("indexed session resilience", () => {
  it("bounds page reads across many bulky checkpoints while preserving their full persisted context", async () => {
    const summary = "original evidence ".repeat(15_000);
    const events = Array.from({ length: 40 }, (_, index) => sent({ ...message(`cp-${index}`, [], "final"), role: "service",
      metadata: { nextclaw_timeline_kind: "context_compaction", checkpoint: { id: `checkpoint-${index}`, status: "compressed", summary } } }));
    const { store, directory, bytes } = await fixture(events); await store.prepare(sessionId);
    let logicalBytes = 0;
    const measured = new SessionMessageSqlProjectionStore({ journalBytes: async () => bytes,
      journalIdentity: () => store.journalIdentity(sessionId), transaction: async operation => operation(), delete: async () => {},
      database: async () => {
        const database = await openSqliteDatabase(join(directory, ".message-projections", sessionId, "messages.sqlite"), { incremental: true });
        const measure = (value: unknown) => { logicalBytes += Buffer.byteLength(JSON.stringify(value) ?? ""); return value; };
        return { ...database, close: () => database.close(), exec: value => database.exec(value), prepare: query => {
          const statement = database.prepare(query);
          return { run: (...args) => statement.run(...args), get: (...args) => measure(statement.get(...args)), all: (...args) => measure(statement.all(...args)) as unknown[] };
        } } as SqliteDatabase;
      } });
    const seen: string[] = []; let cursor: string | undefined;
    do {
      logicalBytes = 0; const page = await measured.listPage({ sessionId, limit: 40, cursor });
      expect(logicalBytes).toBeLessThan(4 * 1024 * 1024);
      expect(JSON.stringify(page)).not.toContain(summary);
      expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(256 * 1024);
      seen.push(...page!.messages.map(value => value.id));
      cursor = page!.pageInfo.hasPreviousPage ? page!.pageInfo.startCursor! : undefined;
    } while (cursor);
    expect(new Set(seen).size).toBe(40);
    logicalBytes = 0;
    const window = await measured.readRunWindow(sessionId);
    expect(logicalBytes).toBeLessThan(10 * 1024 * 1024);
    expect(Buffer.byteLength(JSON.stringify(window!.messages))).toBeLessThanOrEqual(8 * 1024 * 1024);
    const originals = await store.readAll(sessionId);
    expect(originals?.messages).toHaveLength(40);
    expect((originals!.messages[0]!.metadata!.checkpoint as { summary: string }).summary).toBe(summary);
  });
  it("rejects an atomic same-length journal replacement even when every indexed row still matches", async () => {
    const event = sent(message("same-source", [{ type: "text", text: "before" }], "final"));
    const { directory, store } = await fixture([event]); await store.prepare(sessionId);
    const source = await store.captureSource(sessionId, ["same-source"]);
    const replacement = join(directory, "replacement.jsonl");
    await writeFile(replacement, JSON.stringify({ _type: "event", version: 1, seq: 1, timestamp: "2026-10-19T00:00:00.000Z",
      event: sent(message("same-source", [{ type: "text", text: "AFTER!" }], "final")) }) + "\n");
    await rename(replacement, join(directory, `${sessionId}.jsonl`));
    expect(await store.validateSource(sessionId, source)).toBe(false);
    await store.prepare(sessionId);
    expect((await store.readAll(sessionId))?.messages[0]?.parts).toEqual([{ type: "text", text: "AFTER!" }]);
  });

  it("matches full replay across deterministic randomized Unicode, multipart and interleaved delta boundaries", async () => {
    let seed = 0x51abc;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    for (let trial = 0; trial < 20; trial++) {
      const events: NcpAgentSessionJournalReplayEvent[] = [];
      for (let owner = 0; owner < 5; owner++) {
        const id = `random-${trial}-${owner}`;
        let text = "seed";
        events.push(sent(message(id, [{ type: "text", text: "seed" }])));
        for (let index = 0; index < 1 + random() % 16; index++) {
          const delta = ["x", "𝌆", "\ud800", "\\\"\n", "汉字"][random() % 5]!; text += delta;
          events.push({ type: NcpEventType.MessageTextDelta, payload: { sessionId, messageId: id, delta } });
        }
        events.push({ type: NcpEventType.MessageCompleted, payload: { sessionId, message: message(id, [{ type: "text", text }], "final") } });
      }
      const { store } = await fixture(events); await store.prepare(sessionId);
      const expected = await replayNcpAgentSessionEvents(events);
      const actual = (await store.readAll(sessionId))!.messages;
      expect(actual.map(value => ({ id: value.id, status: value.status, parts: value.parts })))
        .toEqual(expected.map(value => ({ id: value.id, status: value.status, parts: value.parts })));
      const page = await store.listPage({ sessionId, limit: 2 });
      const previous = await store.listPage({ sessionId, limit: 2, cursor: page!.pageInfo.startCursor! });
      expect(new Set([...page!.messages, ...previous!.messages].map(value => value.id)).size).toBe(4);
    }
  });
  it("never replaces archived original text with a partial runtime completion", async () => {
    const originalText = "original " + "证据𝌆".repeat(100_000);
    const partial = message("partial-owner", [{ type: "text", text: "preview only" }]);
    partial.metadata = { nextclaw_partial_projection: true, nextclaw_source: { partIndices: [0], partCount: 1 } };
    const events: NcpAgentSessionJournalReplayEvent[] = [sent(message("partial-owner", [{ type: "text", text: originalText }])),
      { type: NcpEventType.MessageTextDelta, payload: { sessionId, messageId: "partial-owner", delta: " suffix evidence" } },
      { type: NcpEventType.MessageCompleted, payload: { sessionId, message: { ...partial, status: "final" } } }];
    const { store } = await fixture(events); await store.prepare(sessionId);
    const indexed = await store.readAll(sessionId);
    const replayed = await replayNcpAgentSessionEvents(events);
    expect(indexed?.messages[0]?.parts).toEqual([{ type: "text", text: originalText + " suffix evidence" }]);
    expect(indexed?.messages[0]?.parts).toEqual(replayed[0]?.parts);
    expect(indexed?.messages[0]?.status).toBe("final");
  });

  it("preserves split surrogate pairs, isolated surrogates and escaping in structured source", async () => {
    const values = Array.from({ length: 32 }, (_, index) => `${"x".repeat(240 + index)}𝌆\ud800\\"\n\udfff`);
    const result = { values };
    const part: NcpMessage["parts"][number] = { type: "tool-invocation", toolCallId: "unicode", toolName: "read", state: "result", args: {}, result };
    const { store } = await fixture([sent(message("unicode-source", [part], "final"))]);
    await store.prepare(sessionId);
    const fragments: string[] = []; let cursor: string | undefined;
    do { const value = await store.readPart(sessionId, "unicode-source", 0, cursor); fragments.push(value!.content); cursor = value!.nextCursor ?? undefined; } while (cursor);
    expect(JSON.parse(fragments.join(""))).toEqual(part);
  });

  it("rejects a source epoch after a later semantic event, including a newly appended message", async () => {
    const { store, bytes } = await fixture([sent(message("source", [{ type: "text", text: "original" }], "final"))]);
    await store.prepare(sessionId);
    const source = await store.captureSource(sessionId, ["source"]);
    expect(await store.validateSource(sessionId, source)).toBe(true);
    await store.appendEvent(sessionId, sent(message("new-suffix", [{ type: "text", text: "new user constraint" }], "final")), bytes + 1, 3, bytes);
    expect(await store.validateSource(sessionId, source)).toBe(false);
  });

  it("matches the existing replayer for streamed text, tool arguments and late results", async () => {
    const events: NcpAgentSessionJournalReplayEvent[] = [
      sent(message("assistant", [{ type: "text", text: "start" }])),
      { type: NcpEventType.MessageTextDelta, payload: { sessionId, messageId: "assistant", delta: "继续𝌆" } },
      { type: NcpEventType.MessageToolCallStart, payload: { sessionId, messageId: "assistant", toolCallId: "call-1", toolName: "lookup" } },
      { type: NcpEventType.MessageToolCallArgsDelta, payload: { sessionId, toolCallId: "call-1", delta: '{"q":' } },
      { type: NcpEventType.MessageToolCallArgsDelta, payload: { sessionId, toolCallId: "call-1", delta: '"hello"}' } },
      { type: NcpEventType.MessageToolCallEnd, payload: { sessionId, toolCallId: "call-1" } },
      { type: NcpEventType.MessageToolCallResult, payload: { sessionId, toolCallId: "call-1", content: { ok: true }, final: true } },
    ];
    const { store } = await fixture(events);
    await store.prepare(sessionId);
    const original = await replayNcpAgentSessionEvents(events);
    const projected = await store.readAll(sessionId);
    expect(projected?.messages.map(value => ({ id: value.id, status: value.status, parts: value.parts })))
      .toEqual(original.map(value => ({ id: value.id, status: value.status, parts: value.parts })));
  });

  it("preserves a giant structured tool result as exact source fragments without putting it in a page", async () => {
    const result = { output: "汉字𝌆\\\"".repeat(400_000), nested: [true, null, { value: 42 }] };
    const part: NcpMessage["parts"][number] = { type: "tool-invocation", toolCallId: "giant-tool", toolName: "read", state: "result", args: {}, result };
    const { directory, store } = await fixture([sent(message("giant", [part], "final"))]);
    await store.prepare(sessionId);
    const cold = new NcpAgentSessionMessageProjectionPersistenceStore(directory);
    const page = await cold.listPage({ sessionId, limit: 40 });
    expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(32 * 1024);
    let cursor: string | undefined;
    const fragments: string[] = [];
    do {
      const fragment = await cold.readPart(sessionId, "giant", 0, cursor);
      expect(fragment).toBeTruthy();
      expect(Buffer.byteLength(fragment!.content)).toBeLessThanOrEqual(32 * 1024);
      fragments.push(fragment!.content); cursor = fragment!.nextCursor ?? undefined;
    } while (cursor);
    expect(JSON.parse(fragments.join(""))).toEqual(part);
  }, 30_000);

  it("coalesces a long legacy delta tail and preserves every character", async () => {
    const events: NcpAgentSessionJournalReplayEvent[] = [sent(message("deltas", [{ type: "text", text: "" }]))];
    for (let index = 0; index < 1_000; index++) events.push({ type: NcpEventType.MessageTextDelta, payload: { sessionId, messageId: "deltas", delta: `${index},` } });
    const { store } = await fixture(events);
    await store.prepare(sessionId);
    const loaded = await store.readAll(sessionId);
    expect(loaded?.messages[0]?.parts).toEqual([{ type: "text", text: Array.from({ length: 1_000 }, (_, index) => `${index},`).join("") }]);
  }, 30_000);

  it("resumes committed preparation after cancellation without duplicating deltas", async () => {
    const events: NcpAgentSessionJournalReplayEvent[] = [sent(message("resume", [{ type: "text", text: "" }]))];
    for (let index = 0; index < 200; index++) events.push({ type: NcpEventType.MessageTextDelta, payload: { sessionId, messageId: "resume", delta: "x".repeat(500) } });
    const { directory, store, bytes } = await fixture(events);
    const controller = new AbortController();
    await expect(store.prepare(sessionId, controller.signal, value => { if (value > bytes / 2) controller.abort(); })).rejects.toMatchObject({ name: "AbortError" });
    const cold = new NcpAgentSessionMessageProjectionPersistenceStore(directory);
    await cold.prepare(sessionId);
    expect((await cold.readAll(sessionId))?.messages[0]?.parts).toEqual([{ type: "text", text: "x".repeat(100_000) }]);
  }, 30_000);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { NcpMessage } from "@nextclaw/ncp";
import { BiboEdgeSessionStore, type BiboEdgeSession } from "./bibo-edge-session.store";

const message = (id: string, text: string): NcpMessage => ({
  id, sessionId: "session-1", role: "user", status: "final", timestamp: "2026-09-29T00:00:00.000Z",
  parts: [{ type: "text", text }],
});

test("large tool-result messages round-trip through bounded DO values and remove obsolete chunks", async () => {
  const data = new Map<string, unknown>();
  const storage = { get: async (key: string | string[]) => Array.isArray(key)
    ? new Map(key.filter((item) => data.has(item)).map((item) => [item, structuredClone(data.get(item))]))
    : structuredClone(data.get(key)) } as unknown as DurableObjectStorage;
  const store = new BiboEdgeSessionStore(storage);
  const long: BiboEdgeSession = { version: 1, messages: [message("large", "a".repeat(2_100_000))], metadata: {} };
  const commit = store.prepareCommit("session-1", null, long);
  assert.equal(Object.keys(commit.entries).filter((key) => key.startsWith("ncpMessage:session-1:large:")).length > 1, true);
  for (const [key, value] of Object.entries(commit.entries)) {
    assert.ok(Buffer.byteLength(JSON.stringify(value)) < 1_800_000);
    data.set(key, value);
  }
  assert.deepEqual(await store.load("session-1"), long);
  const short: BiboEdgeSession = { ...long, messages: [message("large", "short")] };
  const replacement = store.prepareCommit("session-1", long, short);
  for (const [key, value] of Object.entries(replacement.entries)) data.set(key, value);
  for (const key of replacement.deletes) data.delete(key);
  assert.equal([...data.keys()].some((key) => key.startsWith("ncpMessage:session-1:large:")), false);
  assert.deepEqual(await store.load("session-1"), short);
});

test("NCP session commits only changed messages while preserving order and metadata", async () => {
  const data = new Map<string, unknown>();
  const storage = {
    get: async (key: string | string[]) => Array.isArray(key)
      ? new Map(key.filter((item) => data.has(item)).map((item) => [item, structuredClone(data.get(item))]))
      : structuredClone(data.get(key)),
  } as unknown as DurableObjectStorage;
  const store = new BiboEdgeSessionStore(storage);
  const first: BiboEdgeSession = { version: 1, messages: [message("old", "first")], metadata: { label: "kept" } };
  const initial = store.prepareCommit("session-1", null, first);
  for (const [key, value] of Object.entries(initial.entries)) data.set(key, value);
  assert.deepEqual(await store.load("session-1"), first);
  const next: BiboEdgeSession = { ...first, messages: [...first.messages, message("new", "second")] };
  const changed = store.prepareCommit("session-1", first, next);
  assert.deepEqual(Object.keys(changed.entries).sort(), ["ncpMessage:session-1:new", "ncpSession:session-1"]);
  for (const [key, value] of Object.entries(changed.entries)) data.set(key, value);
  assert.deepEqual((await store.load("session-1"))?.messages.map((item) => item.id), ["old", "new"]);
  data.delete("ncpMessage:session-1:old");
  await assert.rejects(store.load("session-1"), /missing/);
});

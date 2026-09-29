import assert from "node:assert/strict";
import test from "node:test";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { CloudflareSessionStore } from "./cloudflare-session.store";
import { applyBiboStorageChanges } from "../utils/bibo-storage.utils";

class Storage {
  values = new Map<string, unknown>();
  fail = false;
  get = async (key: string | string[]) => Array.isArray(key)
    ? new Map(key.filter((id) => this.values.has(id)).map((id) => [id, structuredClone(this.values.get(id))]))
    : structuredClone(this.values.get(key));
  list = async ({ prefix = "" } = {}) => new Map([...this.values].filter(([key]) => key.startsWith(prefix))
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, structuredClone(value)]));
  put = async (key: string, value: unknown) => { this.values.set(key, structuredClone(value)); };
  transaction = async <T>(run: (transaction: DurableObjectTransaction) => Promise<T>): Promise<T> => {
    const next = new Map(this.values);
    const result = await run({
      get: async (key: string | string[]) => Array.isArray(key)
        ? new Map(key.filter((id) => next.has(id)).map((id) => [id, structuredClone(next.get(id))])) : structuredClone(next.get(key)),
      list: async ({ prefix = "" } = {}) => new Map([...next].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b))),
      put: async (entries: Record<string, unknown>) => { for (const [key, value] of Object.entries(entries)) next.set(key, structuredClone(value)); },
      delete: async (keys: string[]) => { for (const key of keys) next.delete(key); },
    } as unknown as DurableObjectTransaction);
    if (this.fail) { this.fail = false; throw new Error("disk failed"); }
    this.values = next;
    return result;
  };
  asStorage = () => this as unknown as DurableObjectStorage;
}
const message = (id: string, text = id): NcpMessage => ({ id, sessionId: "s", role: "user", status: "final",
  timestamp: new Date(0).toISOString(), parts: [{ type: "text", text }] });
async function setup() {
  const storage = new Storage();
  const store = new CloudflareSessionStore(storage.asStorage());
  await store.importSessionSnapshot({ sessionId: "s", agentId: "main", updatedAt: new Date(0).toISOString(), messages: [], metadata: {} });
  return { storage, store };
}

test("journal survives owner restart and checkpoint does not replay a completed turn twice", async () => {
  const { storage, store } = await setup();
  await store.appendSessionEvent({ sessionId: "s", event: { type: NcpEventType.RunStarted, payload: { sessionId: "s", runId: "run" } } });
  await store.appendSessionEvent({ sessionId: "s", event: { type: NcpEventType.MessageSent, payload: { sessionId: "s", message: message("u") } } });
  const restarted = new CloudflareSessionStore(storage.asStorage());
  assert.equal((await restarted.listUnfinishedRuns())[0]?.runId, "run");
  assert.deepEqual((await restarted.listSessionMessages("s")).map((item) => item.id), ["u"]);
  await restarted.appendSessionEvent({ sessionId: "s", event: { type: NcpEventType.RunFinished, payload: { sessionId: "s", runId: "run" } } });
  const checkpoint = await restarted.prepareCheckpoint("s");
  await storage.transaction(async (transaction) => applyBiboStorageChanges(transaction, checkpoint.entries, checkpoint.deletes));
  const compacted = new CloudflareSessionStore(storage.asStorage());
  assert.deepEqual((await compacted.listSessionMessages("s")).map((item) => item.id), ["u"]);
  assert.deepEqual(await compacted.listUnfinishedRuns(), []);
  assert.equal([...storage.values.keys()].some((key) => key.startsWith("sessionTail:")), false);
});

test("failed transaction cannot leak a phantom event and next append recovers", async () => {
  const { storage, store } = await setup();
  storage.fail = true;
  await assert.rejects(store.appendSessionEvent({ sessionId: "s", event: { type: NcpEventType.MessageSent,
    payload: { sessionId: "s", message: message("failed") } } }), /disk failed/);
  assert.deepEqual(await store.listSessionMessages("s"), []);
  await store.appendSessionEvent({ sessionId: "s", event: { type: NcpEventType.MessageSent,
    payload: { sessionId: "s", message: message("ok") } } });
  assert.deepEqual((await new CloudflareSessionStore(storage.asStorage()).listSessionMessages("s")).map((item) => item.id), ["ok"]);
});

test("chunked large event, stable backwards paging, metadata compare and full deletion", async () => {
  const { storage, store } = await setup();
  const large = "中".repeat(700_000);
  for (const item of [message("one"), message("two", large), message("three")]) {
    await store.appendSessionEvent({ sessionId: "s", event: { type: NcpEventType.MessageSent, payload: { sessionId: "s", message: item } } });
  }
  const restarted = new CloudflareSessionStore(storage.asStorage());
  const last = await restarted.listSessionMessagePage({ sessionId: "s", limit: 2 });
  assert.deepEqual(last?.messages.map((item) => item.id), ["two", "three"]);
  assert.equal(JSON.stringify(last?.messages[0]?.parts).includes(large), true);
  const first = await restarted.listSessionMessagePage({ sessionId: "s", limit: 2, cursor: last?.pageInfo.startCursor ?? undefined });
  assert.deepEqual(first?.messages.map((item) => item.id), ["one"]);
  await assert.rejects(restarted.listSessionMessagePage({ sessionId: "s", limit: 2, cursor: "bad" }), /cursor/i);
  assert.equal(await restarted.updateSessionMetadata({ sessionId: "s", metadata: { label: "manual" }, expectedMetadata: { label: undefined } }), true);
  assert.equal(await restarted.updateSessionMetadata({ sessionId: "s", metadata: { label: "stale" }, expectedMetadata: { label: undefined } }), false);
  assert.equal((await restarted.getSession("s"))?.metadata?.label, "manual");
  await restarted.deleteSession("s");
  assert.equal(await new CloudflareSessionStore(storage.asStorage()).getSession("s"), null);
  assert.equal(storage.values.size, 0);
});

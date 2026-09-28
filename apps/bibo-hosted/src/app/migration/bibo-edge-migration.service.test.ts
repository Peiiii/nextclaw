import assert from "node:assert/strict";
import test from "node:test";
import { BiboEdgeMigrationService } from "./bibo-edge-migration.service";
import { BiboEdgeRollbackService } from "./bibo-edge-rollback.service";
import { BiboEdgeSessionStore } from "../stores/bibo-edge-session.store";
import { applyBiboStorageChanges } from "../utils/bibo-storage.utils";

class MemoryStorage {
  values = new Map<string, unknown>();
  get = async (key: string | string[]) => {
    if (!Array.isArray(key)) return structuredClone(this.values.get(key));
    assert.ok(key.length <= 128, "Cloudflare accepts at most 128 keys per get");
    return new Map(key.filter((item) => this.values.has(item)).map((item) => [item, structuredClone(this.values.get(item))]));
  };
  put = async (key: string | Record<string, unknown>, value?: unknown) => {
    for (const [name, item] of typeof key === "string" ? [[key, value]] : Object.entries(key)) this.values.set(name as string, structuredClone(item));
  };
  list = async (options: { prefix: string }) => new Map([...this.values].filter(([key]) => key.startsWith(options.prefix)));
  transaction = async (run: (transaction: unknown) => Promise<void>) => {
    const next = new Map(this.values);
    await run({
      get: async (key: string) => structuredClone(next.get(key)),
      put: async (entries: Record<string, unknown>) => {
        assert.ok(Object.keys(entries).length <= 128, "Cloudflare accepts at most 128 keys per put");
        for (const [key, value] of Object.entries(entries)) next.set(key, structuredClone(value));
      },
      delete: async (keys: string[]) => {
        assert.ok(keys.length <= 128, "Cloudflare accepts at most 128 keys per delete");
        for (const key of keys) next.delete(key);
      },
    });
    this.values = next;
  };
}

test("legacy cutover publishes edge mode only after NCP, file, memory and UI checks", async () => {
  const storage = new MemoryStorage();
  const time = "2026-09-29T00:00:00.000Z";
  const user = { id: "user-1", sessionId: "session-1", role: "user" as const, status: "final" as const,
    timestamp: time, parts: [{ type: "text" as const, text: "hello" }] };
  const assistant = { ...user, id: "assistant-1", role: "assistant" as const, parts: [{ type: "text" as const, text: "reply" }] };
  const file = { id: "file-1", path: "note.md", kind: "note" as const, createdAt: time, updatedAt: time, version: 1 };
  const source: Parameters<BiboEdgeMigrationService["migrate"]>[0] = {
    schema: 1,
    sessions: [{ sessionId: "session-1", record: { sessionId: "session-1", messages: [user, assistant], metadata: { preference: "kept" }, createdAt: time, updatedAt: time } }],
    spaceState: { schema: 1, projects: [], tasks: [], events: [], inbox: [], deliveryStatuses: {}, files: [file], replays: {} },
    files: [{ id: file.id, content: "original body" }],
    workspaceTexts: { "IDENTITY.md": "# Bibo", "memory/MEMORY.md": "Remember me" },
    deliveries: '{"deliveries":[]}',
  };
  const migration = new BiboEdgeMigrationService(storage as unknown as DurableObjectStorage);
  await assert.rejects(migration.migrate(source, [{ id: "session-1", messages: [{ role: "assistant", text: "different" }] }]), /differs/);
  assert.equal(storage.values.has("conversationMode"), false);
  const result = await migration.migrate(source, [{ id: "session-1", messages: [{ role: "assistant", text: "reply" }] }]);
  assert.deepEqual(result, { sessions: 1, messages: 2, files: 1, workspaceTexts: 2 });
  assert.equal(storage.values.get("conversationMode"), "edge");
  assert.equal(storage.values.get("spaceFile:file-1"), "original body");
  assert.equal(storage.values.get("edgeWorkspace:memory/MEMORY.md"), "Remember me");
  assert.equal((await new BiboEdgeSessionStore(storage as unknown as DurableObjectStorage).load("session-1"))?.messages.length, 2);
  const edgeCopy = await new BiboEdgeRollbackService(storage as unknown as DurableObjectStorage).read();
  assert.deepEqual(edgeCopy.files, source.files);
  assert.deepEqual(edgeCopy.sessions[0]?.record?.messages, source.sessions[0]?.record?.messages);
  await assert.rejects(migration.migrate(source, []), /already has edge conversation writes/);
});

test("long old sessions and many workspace texts migrate and delete within Cloudflare's 128-key call limit", async () => {
  const storage = new MemoryStorage();
  const at = "2026-09-29T00:00:00.000Z";
  const messages = Array.from({ length: 260 }, (_, index) => ({ id: `message-${index}`, sessionId: "long-session",
    role: index % 2 ? "assistant" as const : "user" as const, status: "final" as const, timestamp: at,
    parts: [{ type: "text" as const, text: `turn ${index}` }] }));
  const workspaceTexts = Object.fromEntries(Array.from({ length: 151 }, (_, index) => [`note-${index}.txt`, `note ${index}`]));
  const source: Parameters<BiboEdgeMigrationService["migrate"]>[0] = {
    schema: 1, sessions: [{ sessionId: "long-session", record: { sessionId: "long-session", messages,
      metadata: {}, createdAt: at, updatedAt: at } }],
    spaceState: { schema: 1, projects: [], tasks: [], events: [], inbox: [], deliveryStatuses: {}, files: [], replays: {} },
    files: [], workspaceTexts, deliveries: null,
  };
  const result = await new BiboEdgeMigrationService(storage as unknown as DurableObjectStorage).migrate(source, []);
  assert.deepEqual(result, { sessions: 1, messages: 260, files: 0, workspaceTexts: 151 });
  const sessions = new BiboEdgeSessionStore(storage as unknown as DurableObjectStorage);
  const saved = await sessions.load("long-session");
  assert.equal(saved?.messages.length, 260);
  await storage.transaction(async (transaction) => applyBiboStorageChanges(
    transaction as DurableObjectTransaction, {}, sessions.prepareDelete("long-session", saved)));
  assert.equal(await sessions.load("long-session"), null);
});

test("orphaned unfinished journals remain intact while visible unfinished sessions stay on legacy", async () => {
  const at = "2026-09-29T00:00:00.000Z";
  const source: Parameters<BiboEdgeMigrationService["migrate"]>[0] = {
    schema: 1, sessions: [{ sessionId: "orphan", record: { sessionId: "orphan", messages: [{
      id: "unfinished", sessionId: "orphan", role: "assistant", status: "streaming", timestamp: at,
      parts: [{ type: "text", text: "unfinished reply" }],
    }], metadata: {}, createdAt: at, updatedAt: at } }],
    spaceState: { schema: 1, projects: [], tasks: [], events: [], inbox: [], deliveryStatuses: {}, files: [], replays: {} },
    files: [], workspaceTexts: {}, deliveries: null,
  };
  const storage = new MemoryStorage();
  const migration = new BiboEdgeMigrationService(storage as unknown as DurableObjectStorage);
  await assert.rejects(migration.migrate(source, [{ id: "orphan", messages: [] }]), /unfinished/);
  assert.equal(storage.values.has("conversationMode"), false);
  await migration.migrate(source, []);
  assert.equal(storage.values.get("conversationMode"), "edge");
  assert.deepEqual((await new BiboEdgeSessionStore(storage as unknown as DurableObjectStorage).load("orphan"))?.messages,
    source.sessions[0]?.record?.messages);
});

test("a legacy reply is reconciled only when its user journal matches the visible transcript", async () => {
  const at = "2026-09-29T00:00:00.000Z";
  const user = { id: "user", sessionId: "old", role: "user" as const, status: "final" as const,
    timestamp: at, parts: [{ type: "text" as const, text: "question" }] };
  const assistant = { ...user, id: "assistant", role: "assistant" as const, status: "error" as const,
    parts: [{ type: "text" as const, text: "partial" }] };
  const source: Parameters<BiboEdgeMigrationService["migrate"]>[0] = {
    schema: 1, sessions: [{ sessionId: "old", record: { sessionId: "old", messages: [user, assistant],
      metadata: {}, createdAt: at, updatedAt: at } }],
    spaceState: { schema: 1, projects: [], tasks: [], events: [], inbox: [], deliveryStatuses: {}, files: [], replays: {} },
    files: [], workspaceTexts: {}, deliveries: null,
  };
  const storage = new MemoryStorage();
  const migration = new BiboEdgeMigrationService(storage as unknown as DurableObjectStorage);
  await assert.rejects(migration.migrate(source, [{ id: "old", messages: [
    { role: "user", text: "different" }, { role: "assistant", text: "visible reply", at },
  ] }]), /differs/);
  assert.equal(storage.values.has("conversationMode"), false);
  const result = await migration.migrate(source, [{ id: "old", messages: [
    { role: "user", text: "question" }, { role: "assistant", text: "visible reply", at },
  ] }]);
  assert.equal(result.messages, 2);
  const messages = (await new BiboEdgeSessionStore(storage as unknown as DurableObjectStorage).load("old"))?.messages;
  assert.equal(messages?.[1]?.status, "final");
  assert.equal(messages?.[1]?.parts[0]?.type, "text");
  assert.deepEqual(messages?.[1]?.parts, [{ type: "text", text: "visible reply" }]);
  assert.equal(source.sessions[0]?.record?.messages[1]?.status, "error", "source snapshot must stay unchanged");
});

test("multi-turn legacy transcript keeps its NCP message IDs and matches every visible reply", async () => {
  const at = "2026-09-29T00:00:00.000Z";
  const messages = Array.from({ length: 12 }, (_, index) => ({ id: `m-${index}`, sessionId: "old",
    role: index % 2 ? "assistant" as const : "user" as const,
    status: index % 4 === 3 ? "error" as const : "final" as const, timestamp: at,
    parts: [{ type: "text" as const, text: index % 2 ? `outdated ${index}` : `user ${index}` }],
  }));
  const ui = messages.map((message, index) => ({ role: message.role,
    text: index % 2 ? `visible ${index}` : `user ${index}`, at }));
  const source: Parameters<BiboEdgeMigrationService["migrate"]>[0] = {
    schema: 1, sessions: [{ sessionId: "old", record: { sessionId: "old", messages,
      metadata: {}, createdAt: at, updatedAt: at } }],
    spaceState: { schema: 1, projects: [], tasks: [], events: [], inbox: [], deliveryStatuses: {}, files: [], replays: {} },
    files: [], workspaceTexts: {}, deliveries: null,
  };
  const storage = new MemoryStorage();
  await new BiboEdgeMigrationService(storage as unknown as DurableObjectStorage).migrate(source, [{ id: "old", messages: ui }]);
  const saved = (await new BiboEdgeSessionStore(storage as unknown as DurableObjectStorage).load("old"))?.messages;
  assert.equal(saved?.length, 12);
  assert.deepEqual(saved?.map((message) => message.id), messages.map((message) => message.id));
  assert.deepEqual(saved?.map((message) => message.parts[0]), ui.map((message) => ({ type: "text", text: message.text })));
  assert.ok(saved?.every((message) => message.status === "final"));
  assert.equal(messages[3]?.status, "error", "the source journal remains available for rollback inspection");
});

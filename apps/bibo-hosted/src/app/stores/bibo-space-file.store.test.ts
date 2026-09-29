import assert from "node:assert/strict";
import test from "node:test";
import type { BiboFileDetail } from "@nextclaw/bibo-client";
import { BiboSpaceService } from "@/features/bibo-domain";
import { BiboSpaceStateStore } from "../bibo-space-state.service";
import { BiboSpaceFileStore } from "./bibo-space-file.store";

class MemoryStorage {
  values = new Map<string, unknown>();
  failFilePut = false;

  get = async (key: string | string[]) => Array.isArray(key)
    ? new Map(key.filter((item) => this.values.has(item)).map((item) => [item, structuredClone(this.values.get(item))]))
    : structuredClone(this.values.get(key));

  transaction = async (run: (transaction: unknown) => Promise<void>): Promise<void> => {
    const next = new Map(this.values);
    const transaction = {
      get: async (key: string) => structuredClone(next.get(key)),
      put: async (entries: Record<string, unknown>) => {
        if (this.failFilePut && Object.keys(entries).some((key) => key.startsWith("spaceFile:"))) throw new Error("file write failed");
        for (const [key, value] of Object.entries(entries)) next.set(key, structuredClone(value));
      },
      delete: async (keys: string[]) => { for (const key of keys) next.delete(key); },
    };
    await run(transaction);
    this.values = next;
  };
}

class MemoryObjects {
  values = new Map<string, string>();
  failPut = false;
  get = async (key: string) => this.values.has(key) ? { text: async () => this.values.get(key)! } : null;
  put = async (key: string, content: string) => {
    if (this.failPut) throw new Error("object write failed");
    this.values.set(key, content);
  };
  delete = async (key: string) => { this.values.delete(key); };
}

function createSpace(storage: MemoryStorage, objects?: MemoryObjects) {
  const store = new BiboSpaceStateStore(storage as unknown as DurableObjectStorage,
    objects as unknown as R2Bucket | undefined, objects ? "test-user" : undefined);
  const space = new BiboSpaceService("/data", { load: store.load, save: (state) => store.save(state) }, store.files);
  return { space, store };
}

test("DO file content and metadata commit together without path-coupled storage", async () => {
  const storage = new MemoryStorage();
  const { space } = createSpace(storage);
  const created = await space.execute("file.create", { path: "draft.md", kind: "artifact", content: "first" }) as BiboFileDetail;
  assert.equal(storage.values.get(`spaceFile:${created.id}`), "first");

  const reopened = createSpace(storage).space;
  assert.equal((await reopened.execute("file.get", { id: created.id }) as BiboFileDetail).content, "first");
  const updated = await reopened.execute("file.update", { id: created.id, version: created.version, content: "second" }) as BiboFileDetail;
  const moved = await reopened.execute("file.move", { id: created.id, version: updated.version, path: "renamed.md" }) as BiboFileDetail;
  assert.equal(moved.content, "second");
  assert.equal(storage.values.get(`spaceFile:${created.id}`), "second");
  assert.equal((await createSpace(storage).space.execute("file.get", { path: "renamed.md" }) as BiboFileDetail).content, "second");
  await reopened.execute("file.delete", { id: created.id, version: moved.version });
  assert.equal(storage.values.has(`spaceFile:${created.id}`), false);
});

test("failed file commit leaves neither metadata nor content and clears staged data", async () => {
  const storage = new MemoryStorage();
  const { space } = createSpace(storage);
  storage.failFilePut = true;
  await assert.rejects(space.execute("file.create", { path: "lost.md", kind: "artifact", content: "unsaved" }), /file write failed/);
  assert.equal(storage.values.size, 0);
  storage.failFilePut = false;
  const saved = await space.execute("file.create", { path: "saved.md", kind: "artifact", content: "kept" }) as BiboFileDetail;
  assert.equal((await createSpace(storage).space.execute("file.get", { id: saved.id }) as BiboFileDetail).content, "kept");
  assert.equal(storage.values.size, 3);
});

test("DO file content keeps the Node byte limit for multibyte text", async () => {
  const storage = new MemoryStorage();
  const { space } = createSpace(storage);
  const content = "中".repeat(349_526);
  await assert.rejects(space.execute("file.create", { path: "large.md", kind: "artifact", content }), /1 MiB/);
  assert.equal(storage.values.size, 0);
});

test("object-backed file bodies exceed the old DO value limit and remain readable after reopening", async () => {
  const storage = new MemoryStorage();
  const objects = new MemoryObjects();
  const content = "中".repeat(349_526);
  const { space } = createSpace(storage, objects);
  const created = await space.execute("file.create", { path: "large.md", kind: "artifact", content }) as BiboFileDetail;
  const pointer = storage.values.get(`spaceFile:${created.id}`) as { kind: string; key: string; bytes: number };
  assert.equal(pointer.kind, "r2");
  assert.equal(pointer.bytes, new TextEncoder().encode(content).byteLength);
  assert.equal(objects.values.get(pointer.key), content);
  assert.equal((await createSpace(storage, objects).space.execute("file.get", { id: created.id }) as BiboFileDetail).content, content);
});

test("object upload or DO transaction failure never publishes a file pointer", async () => {
  const storage = new MemoryStorage();
  const objects = new MemoryObjects();
  objects.failPut = true;
  await assert.rejects(createSpace(storage, objects).space.execute("file.create", {
    path: "failed-upload.md", kind: "artifact", content: "draft",
  }), /object write failed/);
  assert.equal(storage.values.size, 0);
  objects.failPut = false;
  storage.failFilePut = true;
  await assert.rejects(createSpace(storage, objects).space.execute("file.create", {
    path: "failed-commit.md", kind: "artifact", content: "draft",
  }), /file write failed/);
  assert.equal(storage.values.size, 0);
  assert.equal(objects.values.size, 0);
});

test("run-scoped file changes stay private until session and space commit together", async () => {
  const storage = new MemoryStorage();
  const store = new BiboSpaceStateStore(storage as unknown as DurableObjectStorage);
  const files = new BiboSpaceFileStore(storage as unknown as DurableObjectStorage);
  let stagedState = await store.load();
  const space = new BiboSpaceService("/data", {
    load: async () => stagedState,
    save: async (state) => { stagedState = structuredClone(state); },
  }, files, { read: async () => null });
  const created = await space.execute("file.create", { path: "run.md", kind: "artifact", content: "uncommitted" }) as BiboFileDetail;
  assert.equal(storage.values.size, 0);
  assert.equal((await space.execute("file.get", { id: created.id }) as BiboFileDetail).content, "uncommitted");
  await assert.rejects(createSpace(storage).space.execute("file.get", { id: created.id }), /不存在/);
  await store.save(stagedState!, { "ncpSession:session-1": { messages: ["committed"] } }, files);
  assert.equal(storage.values.get(`spaceFile:${created.id}`), "uncommitted");
  assert.deepEqual(storage.values.get("ncpSession:session-1"), { messages: ["committed"] });
  assert.equal((await createSpace(storage).space.execute("file.get", { id: created.id }) as BiboFileDetail).content, "uncommitted");
});

import assert from "node:assert/strict";
import test from "node:test";
import type { BiboFileDetail } from "@nextclaw/bibo-client";
import { BiboSpaceService } from "@/features/bibo-domain";
import { BiboSpaceStateStore } from "../bibo-space-state.service";

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

function createSpace(storage: MemoryStorage) {
  const store = new BiboSpaceStateStore(storage as unknown as DurableObjectStorage);
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

import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { LocalWorkspaceStore } from "./local-workspace.store.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function workspace(): Promise<{ root: string; store: LocalWorkspaceStore }> {
  const root = await mkdtemp(join(tmpdir(), "nextclaw-workspace-"));
  roots.push(root);
  return { root, store: new LocalWorkspaceStore(join(root, "user")) };
}

it("streams 100 MiB of binary data without a small-text cap and preserves versions", async () => {
  const { store } = await workspace();
  const chunk = new Uint8Array(1024 * 1024);
  chunk[0] = 0xff; chunk[chunk.length - 1] = 0x00;
  let produced = 0;
  const source = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (produced === 100) { controller.close(); return; }
      produced += 1;
      controller.enqueue(chunk);
    },
  });
  const first = await store.write("large.bin", source, { mediaType: "application/octet-stream" });
  expect(first.bytes).toBe(100 * 1024 * 1024);
  expect((await store.stat("large.bin"))?.version).toBe(first.version);
  const opened = await store.read("large.bin");
  expect(opened?.entry.version).toBe(first.version);
  let bytes = 0;
  for await (const part of opened!.body) {
    bytes += part.byteLength;
  }
  expect(bytes).toBe(100 * 1024 * 1024);
  const head = await store.read("large.bin", { offset: 0, length: 1 });
  expect(new Uint8Array(await new Response(head!.body).arrayBuffer())).toEqual(new Uint8Array([0xff]));
  const tail = await store.read("large.bin", { offset: first.bytes - 2, length: 2 });
  expect(new Uint8Array(await new Response(tail!.body).arrayBuffer())).toEqual(new Uint8Array([0, 0]));
  await expect(store.write("large.bin", new ReadableStream(), { expectedVersion: "stale" })).rejects.toThrow(/version/);
  expect((await store.stat("large.bin"))?.version).toBe(first.version);
});

it("keeps directory operations in the configured root and rejects symlink escape", async () => {
  const { root, store } = await workspace();
  const directory = await store.mkdir("notes");
  expect(directory.kind).toBe("directory");
  await store.write("notes/a.txt", new Blob(["hello"]).stream());
  expect((await store.list("notes"))?.entries.map((entry) => entry.path)).toEqual([join(root, "user", "notes", "a.txt")]);
  const moved = await store.move("notes/a.txt", "notes/b.txt");
  expect(await readFile(moved.path, "utf8")).toBe("hello");
  await store.remove("notes/b.txt", moved.version);
  expect(await store.stat("notes/b.txt")).toBeNull();
  await symlink(root, join(root, "user", "outside"));
  await expect(store.write("outside/leak.txt", new Blob(["no"]).stream())).rejects.toThrow(/directory|outside/i);
  expect(() => store.resolve("../escape")).toThrow(/outside/i);
});

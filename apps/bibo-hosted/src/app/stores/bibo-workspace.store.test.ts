import assert from "node:assert/strict";
import { test } from "node:test";
import { BiboWorkspaceStore } from "./bibo-workspace.store.js";
import { BiboWorkspaceFileService } from "../services/bibo-workspace-file.service.js";
import { createBiboContextFiles } from "../utils/bibo-context-files.utils.js";
import type { BiboFileDetail } from "@nextclaw/bibo-client";

test("100 MiB file details read a bounded prefix and use the fetched object's version", async () => {
  const total = 100 * 1024 * 1024;
  let requested = 0;
  const metadata = { path: "/data/workspace/large.txt", kind: "file", bytes: total, mediaType: "text/plain", version: "old" };
  const workspace = { resolve: (path: string) => path, stat: async () => metadata,
    read: async (_path: string, range?: { offset: number; length: number }) => {
      assert.deepEqual(range, { offset: 0, length: 64 * 1024 });
      requested += range!.length;
      const bytes = new Uint8Array(range!.length).fill(65);
      bytes.set(new TextEncoder().encode("中").subarray(0, 2), bytes.length - 2);
      return { entry: { ...metadata, version: "current" }, body: new Blob([bytes]).stream() };
    },
  } as unknown as BiboWorkspaceStore;
  const detail = await new BiboWorkspaceFileService(workspace).execute("file.get", { path: metadata.path }) as BiboFileDetail;
  assert.equal(requested, 64 * 1024);
  assert.equal(detail.version, "current");
  assert.equal(detail.content?.length, 64 * 1024 - 2);
  assert.equal(detail.content?.includes("�"), false);
  assert.deepEqual(detail.preview, { totalBytes: total, readBytes: 64 * 1024, truncated: true, binary: false });
});

test("binary details are not editable text and download preserves exact bytes", async () => {
  const { store } = fixture();
  const bytes = new Uint8Array([0, 255, 128, 42]);
  await store.write("原文件.bin", new Blob([bytes]).stream());
  const service = new BiboWorkspaceFileService(store);
  const detail = await service.execute("file.get", { path: "原文件.bin" }) as BiboFileDetail;
  assert.equal(detail.content, null);
  assert.equal(detail.preview?.binary, true);
  const download = await service.download("原文件.bin");
  assert.deepEqual(new Uint8Array(await download.arrayBuffer()), bytes);
  assert.equal(download.headers.get("content-length"), "4");
  assert.match(download.headers.get("content-disposition")!, /attachment; filename\*=UTF-8''%/);
  await assert.rejects(service.download("/etc/passwd"), /文件路径不正确/);
});

test("real R2 workspace resolves its root and scopes bootstrap reads to the requested directory", async () => {
  const { store } = fixture();
  assert.equal(store.resolve("."), "/data/workspace");
  const reader = createBiboContextFiles(store, true);
  assert.match(await reader.readText("/data/workspace", "IDENTITY.md"), /web_search/);
  await store.write("AGENTS.md", new Blob(["account rules"]).stream());
  await store.mkdir("agents");
  await store.mkdir("agents/researcher");
  await store.write("agents/researcher/AGENTS.md", new Blob(["research rules"]).stream());
  assert.equal(await reader.readText("/data/workspace", "AGENTS.md"), "account rules");
  assert.equal(await reader.readText("/data/workspace/agents/researcher", "AGENTS.md"), "research rules");
  await assert.rejects(async () => reader.readText("/another-account", "AGENTS.md"), /outside workspace/);
});

function fixture() {
  const files = new Map<string, { bytes: Uint8Array; etag: string; mediaType?: string;
    metadata?: Record<string, string>; uploaded: Date }>();
  let revision = 0;
  let beforeFirstMultipartPart: (() => void) | undefined;
  const entry = (key: string) => {
    const file = files.get(key)!;
    return { key, size: file.bytes.length, etag: file.etag, uploaded: file.uploaded,
      customMetadata: file.metadata, httpMetadata: { contentType: file.mediaType } };
  };
  const save = (key: string, bytes: Uint8Array, mediaType?: string, metadata?: Record<string, string>) => {
    files.set(key, { bytes, etag: String(++revision), mediaType, metadata, uploaded: new Date() });
    return entry(key);
  };
  const bucket = {
    async head(key: string) { return files.has(key) ? entry(key) : null; },
    async get(key: string, options?: { range?: { offset: number; length?: number } }) {
      const file = files.get(key);
      if (!file) return null;
      const offset = options?.range?.offset ?? 0;
      const length = options?.range?.length;
      if (options?.range && offset >= file.bytes.length) throw new Error("Unsatisfiable R2 range");
      return { ...entry(key), body: new Blob([new Uint8Array(file.bytes.subarray(offset, length === undefined ? undefined : offset + length))]).stream() };
    },
    async put(key: string, bytes: Uint8Array | ReadableStream<Uint8Array>, options?: {
      onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string };
      httpMetadata?: { contentType: string }; customMetadata?: Record<string, string> }) {
      const { onlyIf, httpMetadata, customMetadata } = options ?? {};
      if (onlyIf?.etagMatches && files.get(key)?.etag !== onlyIf.etagMatches) return null;
      if (onlyIf?.etagDoesNotMatch === "*" && files.has(key)) return null;
      const value = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(await new Response(bytes).arrayBuffer());
      return save(key, value, httpMetadata?.contentType, customMetadata);
    },
    async list(options: { prefix: string; delimiter?: string; cursor?: string; limit?: number }) {
      const { prefix, delimiter, cursor, limit } = options;
      const candidates = new Map<string, "file" | "directory">();
      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const slash = delimiter ? rest.indexOf(delimiter) : -1;
        if (slash >= 0) candidates.set(prefix + rest.slice(0, slash + 1), "directory");
        else candidates.set(key, "file");
      }
      const keys = [...candidates.keys()].sort().filter((key) => !cursor || key > cursor);
      const selected = keys.slice(0, limit ?? 1_000);
      return { objects: selected.filter((key) => candidates.get(key) === "file").map(entry),
        delimitedPrefixes: selected.filter((key) => candidates.get(key) === "directory"),
        truncated: keys.length > selected.length, cursor: selected.at(-1) ?? "" };
    },
    async createMultipartUpload(key: string, options?: { httpMetadata?: { contentType: string };
      customMetadata?: Record<string, string> }) {
      const parts = new Map<number, Uint8Array>();
      return {
        async uploadPart(number: number, bytes: Uint8Array) {
          if (number === 1) { beforeFirstMultipartPart?.(); beforeFirstMultipartPart = undefined; }
          parts.set(number, bytes.slice());
          return { partNumber: number, etag: String(number) };
        },
        async complete(uploaded: { partNumber: number }[]) {
          const size = uploaded.reduce((total, part) => total + parts.get(part.partNumber)!.length, 0);
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const part of uploaded) { const value = parts.get(part.partNumber)!; bytes.set(value, offset); offset += value.length; }
          return save(key, bytes, options?.httpMetadata?.contentType, options?.customMetadata);
        },
        async abort() { parts.clear(); },
      };
    },
    async delete(keys: string | string[]) { for (const key of typeof keys === "string" ? [keys] : keys) files.delete(key); },
  } as unknown as R2Bucket;
  return { files, store: new BiboWorkspaceStore(bucket, "user-1"), save,
    beforeFirstMultipartPart: (callback: () => void) => { beforeFirstMultipartPart = callback; } };
}

test("R2 keys are directly mountable, with byte ranges and version checks", async () => {
  const { files, store } = fixture();
  await store.mkdir("notes");
  assert.equal(await store.mountPrefix("notes"), "/user-1/workspace/notes/");
  const bytes = new Uint8Array(2 * 1024 * 1024 + 1);
  bytes[bytes.length - 1] = 29;
  const first = await store.write("notes/large.bin", new Blob([bytes]).stream());
  assert.deepEqual([...files.keys()].sort(), ["user-1/workspace/notes/", "user-1/workspace/notes/large.bin"]);
  const last = await store.read("notes/large.bin", { offset: bytes.length - 1, length: 1 });
  assert.deepEqual(new Uint8Array(await new Response(last!.body).arrayBuffer()), new Uint8Array([29]));
  await assert.rejects(store.write("notes/large.bin", new Blob(["stale"]).stream(),
    { expectedVersion: "stale" }), /version/);
  assert.equal((await store.stat("notes/large.bin"))?.version, first.version);
});

test("unknown-length streams use bounded multipart upload", async () => {
  const { files, store } = fixture();
  const chunk = new Uint8Array(1024 * 1024);
  chunk[0] = 123;
  let count = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { if (count++ === 12) controller.close(); else controller.enqueue(chunk); },
  });
  assert.equal((await store.write("twelve.bin", body)).bytes, 12 * 1024 * 1024);
  const tail = await store.read("twelve.bin", { offset: 11 * 1024 * 1024, length: 1 });
  assert.deepEqual(new Uint8Array(await new Response(tail!.body).arrayBuffer()), new Uint8Array([123]));
  assert.deepEqual([...files.keys()], ["user-1/workspace/twelve.bin"]);
});

test("multipart publication rejects a concurrent overwrite of an existing file", async () => {
  const { files, store, save, beforeFirstMultipartPart } = fixture();
  const first = await store.write("race.bin", new Blob(["original"]).stream());
  beforeFirstMultipartPart(() => save("user-1/workspace/race.bin", new Uint8Array([9])));
  const large = new Blob([new Uint8Array(6 * 1024 * 1024)]).stream();
  await assert.rejects(store.write("race.bin", large, { expectedVersion: first.version }), /version/);
  assert.deepEqual(files.get("user-1/workspace/race.bin")?.bytes, new Uint8Array([9]));
  assert.deepEqual([...files.keys()], ["user-1/workspace/race.bin"]);
});

test("conditional creation rejects an existing file after the preflight read", async () => {
  const { files, store, save, beforeFirstMultipartPart } = fixture();
  beforeFirstMultipartPart(() => save("user-1/workspace/new.bin", new Uint8Array([8])));
  await assert.rejects(store.write("new.bin", new Blob([new Uint8Array(6 * 1024 * 1024)]).stream()), /version/);
  assert.deepEqual(files.get("user-1/workspace/new.bin")?.bytes, new Uint8Array([8]));
  assert.deepEqual([...files.keys()], ["user-1/workspace/new.bin"]);
});

test("directory move, delete and paged list operate on R2 path keys", async () => {
  const { files, store } = fixture();
  await store.mkdir("src");
  await store.mkdir("src/deep");
  await store.write("src/deep/a.txt", new Blob(["a"]).stream());
  await store.write("src/deep/b.txt", new Blob(["b"]).stream());
  const page = await store.list("src/deep", "", 1);
  assert.deepEqual(page?.entries.map((item) => item.path), ["/data/workspace/src/deep/a.txt"]);
  assert.deepEqual((await store.list("src/deep", page!.nextCursor!, 1))?.entries.map((item) => item.path),
    ["/data/workspace/src/deep/b.txt"]);
  await store.move("src", "moved");
  assert.equal(await store.stat("src/deep/a.txt"), null);
  assert.ok(await store.read("moved/deep/a.txt"));
  await store.remove("moved");
  assert.equal(files.size, 0);
});

test("empty notes can be created, reopened, saved and moved without an unsatisfiable R2 range", async () => {
  const { store } = fixture();
  const service = new BiboWorkspaceFileService(store);
  const created = await service.execute("file.create", { path: "empty.md", kind: "note", content: "" }) as BiboFileDetail;
  assert.equal(created.content, "");
  assert.equal(created.preview, undefined);
  assert.equal((await service.execute("file.get", { id: created.id }) as BiboFileDetail).content, "");
  const saved = await service.execute("file.update", { id: created.id, version: created.version, content: "" }) as BiboFileDetail;
  const moved = await service.execute("file.move", { id: saved.id, version: saved.version, path: "renamed.md" }) as BiboFileDetail;
  assert.equal(moved.content, "");
  await store.write("from-os.md", new Blob([]).stream());
  assert.equal((await service.execute("file.get", { id: "from-os.md" }) as BiboFileDetail).content, "");
});

test("file page, direct Worker tools and mounted OS share R2 immediately without an index", async () => {
  const { store } = fixture();
  const page = new BiboWorkspaceFileService(store);
  await page.execute("file.create", { path: "notes", kind: "folder" });
  const note = await page.execute("file.create", { path: "notes/plan.md", kind: "note", content: "before" }) as {
    id: string; version: string; content: string; kind: string;
  };
  assert.equal(note.id, "notes/plan.md");
  assert.equal(note.kind, "note");
  assert.equal(await store.mountPrefix("notes"), "/user-1/workspace/notes/");
  const changed = await store.write("notes/plan.md", new Blob(["after OS"]).stream());
  assert.equal((await page.execute("file.get", { id: note.id }) as { content: string }).content, "after OS");
  const listed = await page.execute("file.list", { kind: "note" }) as { items: Array<{ path: string; version: string }> };
  assert.deepEqual(listed.items.map((item) => item.path), ["notes/plan.md"]);
  assert.equal(listed.items[0]?.version, changed.version);
  await assert.rejects(page.execute("file.update", { id: note.id, version: note.version, content: "stale" }), /更新/);
  const saved = await page.execute("file.update", { id: note.id, version: changed.version,
    content: "after UI" }) as { content: string; version: string };
  assert.equal(saved.content, "after UI");
  const moved = await page.execute("file.move", { id: note.id, version: saved.version,
    path: "notes/done.md" }) as { id: string; content: string };
  assert.equal(moved.id, "notes/done.md");
  assert.equal(moved.content, "after UI");
  assert.equal(await store.stat("notes/plan.md"), null);
  const removed = await page.execute("file.delete", { id: moved.id,
    version: (await store.stat("notes/done.md"))?.version }) as { deleted: string[] };
  assert.deepEqual(removed.deleted, ["notes/done.md"]);
  assert.equal((await page.execute("file.list", {} ) as { items: unknown[] }).items.length, 1);
});

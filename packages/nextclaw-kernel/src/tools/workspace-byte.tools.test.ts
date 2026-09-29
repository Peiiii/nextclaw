import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalWorkspaceStore } from "@kernel/stores/local-workspace.store.js";
import type { WorkspaceByteStore } from "@kernel/stores/workspace.store.js";
import { createWorkspaceByteTools } from "./workspace-byte.tools.js";

describe("streaming workspace file tools", () => {
  it("previews a 100 MiB single-line file without pulling the whole body", async () => {
    let pulls = 0;
    let cancelled = false;
    const store: WorkspaceByteStore = {
      resolve: (path) => `/workspace/${path}`,
      stat: async () => null,
      list: async () => null,
      read: async () => ({
        entry: { path: "/workspace/large.txt", kind: "file", version: "1", bytes: 100 * 1024 * 1024, mediaType: "text/plain" },
        body: new ReadableStream({
          pull(controller) { pulls += 1; controller.enqueue(new Uint8Array(1024 * 1024).fill(97)); },
          cancel() { cancelled = true; },
        }),
      }),
      write: async () => { throw new Error("unexpected write"); },
      mkdir: async () => { throw new Error("unexpected mkdir"); },
      move: async () => { throw new Error("unexpected move"); },
      remove: async () => { throw new Error("unexpected remove"); },
    };
    const read = createWorkspaceByteTools(store).find((tool) => tool.name === "read_file")!;
    const result = await read.execute({ path: "large.txt" }) as string;
    expect(result).toContain("line truncated to 2000 chars");
    expect(result.length).toBeLessThan(4_000);
    expect(pulls).toBeLessThan(5);
    expect(cancelled).toBe(true);
  });

  it("edits across a stream boundary and retains the remaining file on the local host", async () => {
    const root = await mkdtemp(join(tmpdir(), "nextclaw-byte-tools-"));
    try {
      const path = join(root, "project.txt");
      const before = `first\r\n${"x".repeat(65_534)}TARGET${"y".repeat(1024 * 1024)}\nlast`;
      await writeFile(path, before, "utf8");
      const tools = createWorkspaceByteTools(new LocalWorkspaceStore(root));
      const call = (name: string, args: unknown) => tools.find((tool) => tool.name === name)!.execute(args);
      const edited = await call("edit_file", { path, oldText: "TARGET", newText: "REPLACED" });
      expect(edited).toMatchObject({ oldStartLine: 2 });
      expect(await readFile(path, "utf8")).toBe(before.replace("TARGET", "REPLACED"));
      expect(await call("read_file", { path, offset: 1, limit: 1 })).toContain("1: first");
      expect(await call("write_file", { path: "short.txt", content: "new\ntext" })).toContain("Wrote 8 bytes");
      expect(await call("read_file", { path: "short.txt", offset: 2 })).toContain("2: text");
      expect(await call("list_dir", { path: root })).toContain("project.txt");
      await expect(call("read_file", { path: "../outside" })).rejects.toThrow("outside workspace");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

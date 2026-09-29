import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EditFileTool, ListDirTool, ReadFileTool, WriteFileTool } from "@nextclaw/core";
import { LocalWorkspaceFileStore } from "@kernel/stores/local-workspace-file.store.js";
import { createWorkspaceFileTools, type WorkspaceFilePort } from "./workspace-file.tools.js";

describe("portable workspace file tools", () => {
  it("matches the existing local file tool results on the server host", async () => {
    const root = await mkdtemp(join(tmpdir(), "nextclaw-workspace-tools-"));
    try {
      const path = join(root, "note.md");
      await writeFile(path, "first\nsecond\n", "utf8");
      const tools = createWorkspaceFileTools(new LocalWorkspaceFileStore(root));
      const call = (name: string, input: unknown) => tools.find((tool) => tool.name === name)!.execute(input);
      expect(await call("read_file", { path, offset: 2, limit: 1 })).toEqual(
        await new ReadFileTool(root).execute({ path, offset: 2, limit: 1 }));
      expect(await call("list_dir", { path: root })).toEqual(await new ListDirTool(root).execute({ path: root }));
      expect(await call("write_file", { path, content: "one\ntwo" })).toEqual(
        await new WriteFileTool(root).execute({ path, content: "one\ntwo" }));
      const edited = await call("edit_file", { path, oldText: "one", newText: "three" });
      await writeFile(path, "one\ntwo", "utf8");
      expect(edited).toEqual(await new EditFileTool(root).execute({ path, oldText: "one", newText: "three" }));
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("keeps reads direct, paged and version-checked edits consistent across hosts", async () => {
    const files = new Map<string, { content: string; version: number }>();
    const port: WorkspaceFilePort = {
      resolve: (path) => {
        if (path.includes("..")) throw new Error("outside workspace");
        return `/workspace/${path.replace(/^\/workspace\//, "")}`;
      },
      read: async (path) => files.get(path) ?? null,
      write: async (path, content, version) => {
        const prior = files.get(path);
        if (version !== undefined && prior?.version !== version) throw new Error("version conflict");
        files.set(path, { content, version: (prior?.version ?? 0) + 1 });
      },
      list: async () => [{ name: "note.md", directory: false, bytes: 11 }],
    };
    const tools = createWorkspaceFileTools(port);
    const call = async (name: string, value: unknown) => tools.find((tool) => tool.name === name)!.execute(value);
    expect(await call("write_file", { path: "note.md", content: "first\nline" })).toContain("Wrote");
    expect(await call("read_file", { path: "note.md", offset: 2 })).toContain("2: line");
    expect(await call("edit_file", { path: "note.md", oldText: "first", newText: "new" })).toMatchObject({ oldStartLine: 1 });
    expect(await call("read_file", { path: "note.md" })).toContain("1: new");
    expect(await call("list_dir", { path: "." })).toBe("note.md (11 bytes)");
    await expect(call("read_file", { path: "../other" })).rejects.toThrow("outside workspace");
    expect(tools.filter((tool) => tool.supportsParallelToolCalls).map((tool) => tool.name)).toEqual(["read_file", "list_dir"]);
  });
});

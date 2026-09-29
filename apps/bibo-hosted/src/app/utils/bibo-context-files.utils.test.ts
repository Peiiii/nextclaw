import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceByteStore } from "@nextclaw/kernel";
import { createBiboContextFiles } from "./bibo-context-files.utils";

test("edge context reads identity and memory from the mounted workspace source", async () => {
  const values = new Map<string, string>([
    ["/data/workspace/IDENTITY.md", "# My personal Bibo"],
    ["/data/workspace/memory/MEMORY.md", "Prefers concise answers."],
    ["/data/workspace/agents/researcher/IDENTITY.md", "Researcher identity"],
  ]);
  const workspace = { resolve: (path: string) => path === "." ? "/data/workspace" : path, read: async (path: string) => {
    const value = values.get(path);
    return value === undefined ? null : { body: new Response(value).body! };
  } } as WorkspaceByteStore;
  assert.equal(await createBiboContextFiles(workspace).readText("/data/workspace", "IDENTITY.md"), "# My personal Bibo");
  assert.equal(await createBiboContextFiles(workspace).readText("/data/workspace", "memory/MEMORY.md"), "Prefers concise answers.");
  assert.equal(await createBiboContextFiles(workspace).readText("/data/workspace/agents/researcher", "IDENTITY.md"), "Researcher identity");
  assert.equal(await createBiboContextFiles(workspace).readText("/data/workspace/agents/researcher", "memory/MEMORY.md"), "");
});

test("new edge accounts receive the search-capable Bibo identity when search is configured", async () => {
  const workspace = { resolve: (path: string) => path === "." ? "/data/workspace" : path, read: async () => null } as unknown as WorkspaceByteStore;
  const identity = await createBiboContextFiles(workspace, true).readText("/data/workspace", "IDENTITY.md");
  assert.match(identity, /web_search/);
  assert.equal(await createBiboContextFiles(workspace, true).readText("/data/workspace/agents/other", "IDENTITY.md"), "");
});

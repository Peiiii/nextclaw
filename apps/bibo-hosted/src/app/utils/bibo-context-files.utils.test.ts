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

test("remote context batches overlap I/O, bound large UTF-8 text and observe later edits", async () => {
  let contents = "中文🌱".repeat(100_000);
  let active = 0;
  let peak = 0;
  const workspace = { resolve: (path: string) => path, read: async (_path: string, range?: { offset: number; length: number }) => {
    active++; peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    const bytes = new TextEncoder().encode(contents);
    assert.ok(range && range.length <= 416);
    return { entry: { bytes: bytes.length }, body: new Response(bytes.slice(range.offset, range.offset + range.length)).body! };
  } } as unknown as WorkspaceByteStore;
  const files = createBiboContextFiles(workspace);
  const batch = await files.readTexts!("/data/workspace", ["AGENTS.md", "SOUL.md", "USER.md", "TOOLS.md"], 100);
  assert.equal(peak, 4);
  for (const text of batch.values()) {
    assert.ok(text.length <= 100);
    assert.ok(text.includes("Context truncated"));
    assert.ok(!text.includes("�"));
  }
  for (const maxChars of [100, 101, 102, 103]) {
    const text = await files.readText("/data/workspace", "AGENTS.md", maxChars);
    assert.ok(!/\p{Surrogate}/u.test(text), "bounded text must not split an emoji surrogate pair");
  }
  contents = "Updated rules";
  assert.equal(await files.readText("/data/workspace", "AGENTS.md", 100), "Updated rules");
});

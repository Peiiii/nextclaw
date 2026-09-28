import assert from "node:assert/strict";
import test from "node:test";
import { buildBiboEdgeContext } from "./bibo-edge-context.service";

test("edge context restores migrated identity and memory without a container", async () => {
  const values = new Map<string, unknown>([
    ["edgeWorkspaceIndex", ["IDENTITY.md", "memory/MEMORY.md"]],
    ["edgeWorkspace:IDENTITY.md", "# My personal Bibo"],
    ["edgeWorkspace:memory/MEMORY.md", "Prefers concise answers."],
  ]);
  const storage = { get: async (key: string) => values.get(key) } as unknown as DurableObjectStorage;
  const context = await buildBiboEdgeContext(storage, "old-session");
  assert.equal(context.join("\n").includes("# My personal Bibo"), true);
  assert.equal(context.join("\n").includes("Prefers concise answers."), true);
  assert.equal(context.join("\n").includes("old-session"), true);
});

test("new edge accounts receive the search-capable Bibo identity when search is configured", async () => {
  const storage = { get: async () => undefined } as unknown as DurableObjectStorage;
  const context = await buildBiboEdgeContext(storage, "new-session", true);
  assert.match(context.join("\n"), /web_search/);
});

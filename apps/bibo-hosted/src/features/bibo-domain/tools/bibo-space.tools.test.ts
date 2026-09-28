import assert from "node:assert/strict";
import test from "node:test";
import type { BiboSpaceService } from "../services/bibo-space.service";
import { biboSpaceToolParameters, createBiboSpaceTool } from "./bibo-space.tools";

test("Node and portable Bibo tools share the same behavior and schema", async () => {
  const calls: unknown[] = [];
  const space = {
    listActions: () => [{ action: "task.list", domain: "tasks", description: "list", input: "{}" }],
    execute: async (...args: unknown[]) => { calls.push(args); return { items: [] }; },
  } as unknown as BiboSpaceService;
  const node = createBiboSpaceTool(space, "session-1");
  const portable = createBiboSpaceTool(space, "session-1", true);
  assert.deepEqual(node.parameters, biboSpaceToolParameters);
  assert.equal(portable.parameters, undefined);
  assert.deepEqual(portable.validateArgs?.({ operation: "call", action: "task.list", input: {} }), []);
  assert.ok(portable.validateArgs?.({ operation: "call", unknown: true }).some((issue) => issue.includes("unknown")));
  assert.ok(portable.validateArgs?.({ operation: "unknown" }).some((issue) => issue.includes("operation")));
  for (const tool of [node, portable]) {
    assert.deepEqual(await tool.execute({ operation: "help" }), { ok: true, actions: space.listActions() });
    assert.deepEqual(await tool.execute({ operation: "call", action: "task.list", input: {} }), {
      ok: true, action: "task.list", result: { items: [] }, persistence: "Saved with the completed Bibo reply.",
    });
  }
  assert.deepEqual(calls, [
    ["task.list", {}, { kind: "agent", sessionId: "session-1" }],
    ["task.list", {}, { kind: "agent", sessionId: "session-1" }],
  ]);
});

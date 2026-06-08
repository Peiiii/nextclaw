import assert from "node:assert/strict";
import test from "node:test";

import { evaluateFrozenDirectoryViolation } from "./lint-new-code-frozen-directories.mjs";

test("returns an error when a changed file touches a still-frozen directory", () => {
  const violation = evaluateFrozenDirectoryViolation({
    rule: {
      directoryPath: "packages/nextclaw-core/src/agent",
      maxDirectCodeFiles: 12,
      reason: "agent 根目录仍然过于拥挤"
    },
    changedFiles: [
      "packages/nextclaw-core/src/agent/subagent.ts",
      "packages/nextclaw-core/src/agent/tools/spawn.ts"
    ],
    currentDirectCodeFileCount: 24
  });

  assert.equal(violation?.level, "error");
  assert.match(violation?.message ?? "", /still has 24 direct code files/);
  assert.deepEqual(violation?.touchedFiles, [
    "packages/nextclaw-core/src/agent/subagent.ts",
    "packages/nextclaw-core/src/agent/tools/spawn.ts"
  ]);
});

test("does not report a violation once the frozen directory has been reduced below budget", () => {
  const violation = evaluateFrozenDirectoryViolation({
    rule: {
      directoryPath: "packages/nextclaw-core/src/agent",
      maxDirectCodeFiles: 12,
      reason: "agent 根目录仍然过于拥挤"
    },
    changedFiles: ["packages/nextclaw-core/src/agent/subagent.ts"],
    currentDirectCodeFileCount: 11
  });

  assert.equal(violation, null);
});

test("ignores changes outside of the frozen directory", () => {
  const violation = evaluateFrozenDirectoryViolation({
    rule: {
      directoryPath: "packages/nextclaw-core/src/agent",
      maxDirectCodeFiles: 12,
      reason: "agent 根目录仍然过于拥挤"
    },
    changedFiles: ["packages/nextclaw-core/src/config/index.ts"],
    currentDirectCodeFileCount: 24
  });

  assert.equal(violation, null);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  createParallelWorktreePlan,
  parseParallelWorktreeArgs,
} from "./create-parallel-worktree.mjs";

test("creates an isolated branch plan with offline dependency linking", () => {
  const options = parseParallelWorktreeArgs(["--", "--name", "mini-app-cli"]);
  assert.deepEqual(createParallelWorktreePlan({
    ...options,
    root: "/workspace/nextbot",
  }), {
    base: "master",
    branch: "codex/mini-app-cli",
    root: "/workspace/nextbot",
    targetPath: "/workspace/nextbot-mini-app-cli",
    bootstrap: ["install", "--frozen-lockfile", "--offline", "--ignore-scripts"],
  });
});

test("rejects unsafe or ambiguous parallel worktree names", () => {
  assert.throws(() => parseParallelWorktreeArgs([]), /--name/);
  assert.throws(() => parseParallelWorktreeArgs(["--name", "Mini App"]), /kebab-case/);
});

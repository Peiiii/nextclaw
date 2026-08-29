import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProjectNodeVersion,
  createParallelWorktreePlan,
  parseParallelWorktreeArgs,
} from "./create-parallel-worktree.mjs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

test("rejects worktree bootstrap before dependency install when Node differs from .nvmrc", () => {
  const root = mkdtempSync(join(tmpdir(), "nextclaw-node-contract-"));
  try {
    writeFileSync(join(root, ".nvmrc"), "22.16.0\n");
    assert.equal(assertProjectNodeVersion(root, "22.16.0"), "22.16.0");
    assert.throws(
      () => assertProjectNodeVersion(root, "25.6.1"),
      /requires Node 22\.16\.0; current Node is 25\.6\.1/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

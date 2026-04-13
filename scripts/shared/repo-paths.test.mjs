import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { findRepoRoot, isRepoRootDirectory, resolveRepoPath } from "./repo-paths.mjs";

test("isRepoRootDirectory recognizes the workspace root", () => {
  assert.equal(isRepoRootDirectory(process.cwd()), true);
});

test("findRepoRoot resolves the repository root for scripts under scripts/", () => {
  const repoRoot = process.cwd();
  const devRunnerUrl = pathToFileURL(resolve(repoRoot, "scripts/dev/dev-runner.mjs"));
  const metricsUrl = pathToFileURL(resolve(repoRoot, "scripts/metrics/code-volume-metrics.mjs"));

  assert.equal(findRepoRoot(devRunnerUrl), repoRoot);
  assert.equal(findRepoRoot(metricsUrl), repoRoot);
});

test("resolveRepoPath resolves repository-relative targets", () => {
  const repoRoot = process.cwd();
  const devRunnerUrl = pathToFileURL(resolve(repoRoot, "scripts/dev/dev-runner.mjs"));

  assert.equal(
    resolveRepoPath(devRunnerUrl, "packages/nextclaw"),
    resolve(repoRoot, "packages/nextclaw")
  );
});

test("findRepoRoot fails outside a repository marker tree", () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "nextclaw-repo-paths-"));
  const nestedDir = resolve(tempRoot, "nested", "scripts");
  mkdirSync(nestedDir, { recursive: true });
  const fakeScriptPath = resolve(nestedDir, "fake-script.mjs");
  writeFileSync(fakeScriptPath, "export {};\n", "utf8");

  assert.throws(
    () => findRepoRoot(pathToFileURL(fakeScriptPath)),
    /Unable to locate repo root/
  );
});

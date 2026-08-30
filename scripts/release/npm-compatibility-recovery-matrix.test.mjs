import assert from "node:assert/strict";
import test from "node:test";

import {
  NPM_COMPATIBILITY_MATRIX,
  resolveNpmCompatibilityRecoveryMatrix,
} from "./npm-compatibility-recovery-matrix.mjs";

test("uses the full compatibility matrix for a new immutable package identity", () => {
  const result = resolveNpmCompatibilityRecoveryMatrix({ isRecovery: false });
  assert.equal(result.reused, false);
  assert.equal(result.include.length, 16);
});

test("reruns only failed or cancelled compatibility jobs for a stable recovery", () => {
  const jobs = NPM_COMPATIBILITY_MATRIX.map((entry) => ({
    name: `verify NPM ${entry.platform} Node ${entry.node}`,
    conclusion: entry.platform === "windows-x64" ? "failure" : "success",
  }));
  const result = resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs });
  assert.equal(result.reused, false);
  assert.deepEqual(result.include.map((entry) => entry.platform), [
    "windows-x64", "windows-x64", "windows-x64", "windows-x64",
  ]);
});

test("reuses complete immutable identity evidence without scheduling another matrix", () => {
  const jobs = NPM_COMPATIBILITY_MATRIX.map((entry) => ({
    name: `verify NPM ${entry.platform} Node ${entry.node}`,
    conclusion: "success",
  }));
  assert.deepEqual(
    resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs }),
    {
      include: [{ node: "reused", os: "ubuntu-22.04", platform: "reused", reused: true }],
      reused: true,
    },
  );
});

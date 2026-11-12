import assert from "node:assert/strict";
import test from "node:test";

import {
  NPM_COMPATIBILITY_MATRIX,
  resolveNpmCompatibilityRecoveryMatrix,
} from "./npm-compatibility-recovery-matrix.mjs";

const identity = { sourceCommit: "a".repeat(40), targetVersion: "0.59.4" };

test("uses the full compatibility matrix for a new immutable package identity", () => {
  const result = resolveNpmCompatibilityRecoveryMatrix({ isRecovery: false });
  assert.equal(result.reused, false);
  assert.equal(result.include.length, 16);
});

test("reruns only failed or cancelled compatibility jobs for a stable recovery", () => {
  for (const [platform, conclusion] of [["windows-x64", "failure"], ["darwin-arm64", "cancelled"]]) {
    const jobs = NPM_COMPATIBILITY_MATRIX.map((entry) => ({
      name: `verify NPM ${entry.platform} Node ${entry.node} @${identity.targetVersion}`,
      conclusion: entry.platform === platform ? conclusion : "success",
    }));
    const result = resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs, ...identity });
    assert.equal(result.reused, false);
    assert.deepEqual(result.include.map((entry) => entry.platform), [
      platform, platform, platform, platform,
    ]);
  }
});

test("reuses a successful cell from an earlier run of the same immutable identity", () => {
  const windows20 = NPM_COMPATIBILITY_MATRIX.find((entry) =>
    entry.platform === "windows-x64" && entry.node === "20.19.0",
  );
  const jobs = [
    { name: `verify NPM ${windows20.platform} Node ${windows20.node} @${identity.targetVersion}`, conclusion: "success" },
    ...NPM_COMPATIBILITY_MATRIX.filter((entry) => entry !== windows20).map((entry) => ({
      name: `verify NPM ${entry.platform} Node ${entry.node} @${identity.targetVersion}`,
      conclusion: "failure",
    })),
    { name: `verify NPM ${windows20.platform} Node ${windows20.node} @${identity.targetVersion}`, conclusion: "cancelled" },
  ];
  const result = resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs, ...identity });
  assert.equal(result.include.some((entry) => entry === windows20), false);
});

test("reuses complete immutable identity evidence without scheduling another matrix", () => {
  const jobs = NPM_COMPATIBILITY_MATRIX.map((entry) => ({
    name: `verify NPM ${entry.platform} Node ${entry.node} @${identity.targetVersion}`,
    conclusion: "success",
  }));
  assert.deepEqual(
    resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs, ...identity }),
    {
      include: [{ node: "reused", os: "ubuntu-22.04", platform: "reused", reused: true }],
      reused: true,
    },
  );
});

test("rejects older-version evidence and only accepts legacy jobs from the exact immutable source", () => {
  const legacy = NPM_COMPATIBILITY_MATRIX.map(entry => ({ name: `verify NPM ${entry.platform} Node ${entry.node}`,
    conclusion: "success", sourceCommit: "b".repeat(40) }));
  const older = NPM_COMPATIBILITY_MATRIX.map(entry => ({ name: `verify NPM ${entry.platform} Node ${entry.node} @0.59.3`, conclusion: "success" }));
  const rejected = resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs: [...legacy, ...older], ...identity });
  assert.equal(rejected.include.length, 16);
  assert.equal(rejected.reused, false);
  const accepted = legacy.map(job => ({ ...job, sourceCommit: identity.sourceCommit }));
  assert.equal(resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs: accepted, ...identity }).reused, true);
  assert.throws(() => resolveNpmCompatibilityRecoveryMatrix({ isRecovery: true, jobs: accepted }), /immutable source/);
});

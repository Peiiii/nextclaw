import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { aggregateCases, benchmarkSettings, compareMatrixReports, evaluateCostParity, firstRequestCacheSensitivity, MATRIX_SCHEMA, renderStagedReport } from "./report.utils.mjs";
import { prepareTaskFixture, verifyTaskFixture } from "#benchmark/tasks/fixtures.config.mjs";

const sample = (taskId, input, cached, passed = true) => ({ harness: "nextclaw", taskId, passed,
  durationMs: 100, modelRequestMs: 80,
  calls: [{ tokens: { input, cached, output: 2, reasoning: 1, complete: true }, estimatedCostUsd: 0.01 }] });

test("staged reports keep failed spending visible without awarding a core cache score", () => {
  const total = aggregateCases([sample("files", 100, 99, false)], ["files"]).nextclaw;
  const report = renderStagedReport({ totals: { s0: total }, changes: {}, cases: [], budget: { used: 0.01, calls: 1, limit: 0.25 } });
  assert.match(report, /无有效核心成绩/);
  assert.match(report, /0\.010000000/);
  assert.doesNotMatch(report, /99\.00%/);
});

test("cost parity requires complete tasks and distinguishes execution from cost success", () => {
  const totals = { nextclaw: { valid: true, estimatedCostUsd: 1.28 }, dsh: { valid: true, estimatedCostUsd: 1 } };
  assert.equal(evaluateCostParity(totals).passed, false);
  totals.nextclaw.estimatedCostUsd = 1.05;
  assert.equal(evaluateCostParity(totals).passed, true);
  totals.nextclaw.valid = false;
  assert.equal(evaluateCostParity(totals).premium, null);
  assert.equal(evaluateCostParity(totals).passed, false);
});

test("first-request cold sensitivity reprices only initial hits and refuses missing prices", () => {
  const entry = sample("files", 100, 90);
  const total = { valid: true, estimatedCostUsd: 0.01 };
  assert.equal(firstRequestCacheSensitivity([entry], total), null);
  entry.calls[0].prices = { input: 2, cached: 1 };
  entry.calls.push({ tokens: { input: 1000, cached: 900, complete: true }, prices: { input: 2, cached: 1 } });
  assert.deepEqual(firstRequestCacheSensitivity([entry], total), { firstRequestCachedTokens: 90, coldFirstRequestCostUsd: 0.01009 });
  assert.equal(firstRequestCacheSensitivity([entry], { ...total, valid: false }), null);
});

test("golden metric weights tokens, includes first requests, and requires every fixed task", () => {
  const result = aggregateCases([sample("files", 100, 10), sample("config", 1000, 900)], ["files", "config"]);
  assert.equal(result.nextclaw.goldenCacheHitRate, 910 / 1100);
  assert.equal(result.nextclaw.totalTokens, 1104);
  assert.equal(result.dsh.goldenCacheHitRate, null);
});

test("failed or duplicate tasks cannot become a valid score, but their spend remains visible", () => {
  const failed = aggregateCases([sample("files", 100, 90, false)], ["files"]);
  assert.equal(failed.nextclaw.goldenCacheHitRate, null);
  assert.equal(failed.nextclaw.estimatedCostUsd, 0.01);
  const duplicate = aggregateCases([sample("files", 100, 90), sample("files", 100, 90)], ["files", "config"]);
  assert.equal(duplicate.nextclaw.valid, false);
});

test("changed task mix or output caps refuse direct regression comparison", () => {
  const before = { schema: MATRIX_SCHEMA, settings: benchmarkSettings() };
  assert.throws(() => compareMatrixReports(before, { ...before, settings: benchmarkSettings(["repair"]) }), /settings differ/);
  const oldSettings = { ...before.settings }; delete oldSettings.environmentProfile;
  assert.throws(() => compareMatrixReports({ ...before, settings: oldSettings }, before), /settings differ/);
});

test("missing wall-clock measurements cannot imply a zero timing delta", () => {
  const totals = aggregateCases([sample("files", 100, 90)], ["files"]);
  totals.nextclaw.durationMs = null;
  const report = { schema: MATRIX_SCHEMA, settings: benchmarkSettings(["files"]), totals };
  assert.equal(compareMatrixReports(report, report).nextclaw.durationMsDelta, null);
});

test("repair acceptance rejects original code and verifies inclusive weight boundary without test edits", () => {
  const workspace = mkdtempSync(join(tmpdir(), "agent-benchmark-test-"));
  try {
    prepareTaskFixture("repair", workspace, "read");
    assert.equal(verifyTaskFixture({ taskId: "repair", workspace }).testsPassed, false);
    const path = join(workspace, "shipping.py");
    writeFileSync(path, readFileSync(path, "utf8").replace("weight < 5", "weight <= 5"));
    assert.equal(verifyTaskFixture({ taskId: "repair", workspace }).testsPassed, true);
    writeFileSync(join(workspace, "test_shipping.py"), "pass\n");
    assert.equal(verifyTaskFixture({ taskId: "repair", workspace }).testsUnchanged, false);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

import assert from "node:assert/strict";
import test from "node:test";

import { collectStatefulOrchestratorViolations } from "./lint-new-code-stateful-orchestrators.mjs";

test("flags touched module-scope state shared across multiple lifecycle top-level functions", () => {
  const source = `
let activeTimers = new Map<string, number>();

export function startTimer(id: string) {
  activeTimers.set(id, 1);
}

export function stopTimer(id: string) {
  activeTimers.delete(id);
}

export function resetTimers() {
  activeTimers.clear();
}
`.trim();

  const violations = collectStatefulOrchestratorViolations({
    filePath: "packages/demo/src/timer-runtime.ts",
    source,
    addedLines: new Set([4])
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /top-level functions/);
});

test("does not flag pure top-level helpers without shared state", () => {
  const source = `
export function startLabel(value: string) {
  return value.trim();
}

export function stopLabel(value: string) {
  return value.toLowerCase();
}

export function resetLabel(value: string) {
  return value.toUpperCase();
}
`.trim();

  const violations = collectStatefulOrchestratorViolations({
    filePath: "packages/demo/src/labels.ts",
    source,
    addedLines: new Set([2])
  });

  assert.equal(violations.length, 0);
});

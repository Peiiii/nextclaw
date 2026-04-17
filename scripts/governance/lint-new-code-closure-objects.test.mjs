import assert from "node:assert/strict";
import test from "node:test";

import { collectClosureObjectViolations } from "./lint-new-code-closure-objects.mjs";

test("flags a touched factory that returns a closure-backed multi-method owner object", () => {
  const source = `
export function createRunner() {
  let active = false;
  let currentTask = "idle";

  return {
    start() {
      active = true;
      currentTask = "start";
    },
    stop() {
      active = false;
      currentTask = "stop";
    },
    reset() {
      currentTask = "idle";
    },
    status: () => ({ active, currentTask }),
  };
}
`.trim();

  const violations = collectClosureObjectViolations({
    filePath: "packages/demo/src/create-runner.ts",
    source,
    addedLines: new Set([8])
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /promote it to a class or explicit owner abstraction/);
});

test("does not flag a touched factory that returns a simple stateless helper object", () => {
  const source = `
export function createFormatters() {
  return {
    title: (value: string) => value.trim(),
    lower: (value: string) => value.toLowerCase(),
    upper: (value: string) => value.toUpperCase(),
  };
}
`.trim();

  const violations = collectClosureObjectViolations({
    filePath: "packages/demo/src/create-formatters.ts",
    source,
    addedLines: new Set([3])
  });

  assert.equal(violations.length, 0);
});

test("skips non-js-ts source files instead of trying to parse them", () => {
  const violations = collectClosureObjectViolations({
    filePath: "packages/demo/src/hermes-acp-route-bridge/sitecustomize.py",
    source: "def hello():\n    return 'world'\n",
    addedLines: new Set([1])
  });

  assert.deepEqual(violations, []);
});

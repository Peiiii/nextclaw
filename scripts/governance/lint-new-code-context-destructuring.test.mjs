import assert from "node:assert/strict";
import test from "node:test";

import { collectContextDestructuringViolationsForTouchedFunctions } from "./lint-new-code-context-destructuring.mjs";

test("reports repeated params member reads inside a touched function", () => {
  const source = `
export function resolveAgentProfile(params: { a: string; b: string; c: string; d: string }) {
  return params.a + params.b + params.c + params.d;
}
`.trim();

  const violations = collectContextDestructuringViolationsForTouchedFunctions({
    filePath: "packages/demo/src/context.ts",
    source,
    addedLines: new Set([2])
  });

  assert.equal(violations.length, 1);
  assert.equal(violations[0].functionName, "resolveAgentProfile");
  assert.equal(violations[0].paramName, "params");
  assert.equal(violations[0].count, 4);
});

test("does not report an untouched function in the same file", () => {
  const source = `
export function untouched(params: { a: string; b: string; c: string; d: string }) {
  return params.a + params.b + params.c + params.d;
}

export function touched(params: { a: string; b: string; c: string; d: string }) {
  const { a, b, c, d } = params;
  return a + b + c + d;
}
`.trim();

  const violations = collectContextDestructuringViolationsForTouchedFunctions({
    filePath: "packages/demo/src/context.ts",
    source,
    addedLines: new Set([6, 7])
  });

  assert.equal(violations.length, 0);
});

test("does not report a touched function that already destructures top-level fields", () => {
  const source = `
export const buildThing = (options: { a: string; b: string; c: string; d: string }) => {
  const { a, b, c, d } = options;
  return a + b + c + d;
};
`.trim();

  const violations = collectContextDestructuringViolationsForTouchedFunctions({
    filePath: "packages/demo/src/context.ts",
    source,
    addedLines: new Set([2])
  });

  assert.equal(violations.length, 0);
});

test("does not report accesses below the governance threshold", () => {
  const source = `
export function buildThing(context: { a: string; b: string; c: string }) {
  return context.a + context.b + context.c;
}
`.trim();

  const violations = collectContextDestructuringViolationsForTouchedFunctions({
    filePath: "packages/demo/src/context.ts",
    source,
    addedLines: new Set([2])
  });

  assert.equal(violations.length, 0);
});

test("skips non-js-ts source files instead of trying to parse them", () => {
  const violations = collectContextDestructuringViolationsForTouchedFunctions({
    filePath: "packages/demo/src/hermes-acp-route-bridge/sitecustomize.py",
    source: "def hello():\n    return 'world'\n",
    addedLines: new Set([1])
  });

  assert.deepEqual(violations, []);
});

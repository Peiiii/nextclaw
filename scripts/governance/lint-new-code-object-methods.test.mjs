import assert from "node:assert/strict";
import test from "node:test";

import { collectViolationsForTouchedObjectLiterals } from "./lint-new-code-object-methods.mjs";

test("reports every shorthand method inside a touched object literal", () => {
  const source = `
const handlers = {
  load() {
    return "load";
  },

  save() {
    return "save";
  },

  reset: () => "reset",
};
`.trim();

  const violations = collectViolationsForTouchedObjectLiterals({
    filePath: "packages/demo/src/handlers.ts",
    source,
    addedLines: new Set([6])
  });

  assert.deepEqual(
    violations.map((item) => `${item.objectLabel}.${item.propertyName}`),
    ["handlers.load", "handlers.save"]
  );
});

test("does not report untouched object literals in the same file", () => {
  const source = `
const untouchedHandlers = {
  load() {
    return "load";
  },
};

const touchedHandlers = {
  save() {
    return "save";
  },

  reset: () => "reset",
};
`.trim();

  const violations = collectViolationsForTouchedObjectLiterals({
    filePath: "packages/demo/src/handlers.ts",
    source,
    addedLines: new Set([8])
  });

  assert.deepEqual(
    violations.map((item) => `${item.objectLabel}.${item.propertyName}`),
    ["touchedHandlers.save"]
  );
});

test("ignores getters and setters when scanning a touched object literal", () => {
  const source = `
const store = {
  get value() {
    return "value";
  },

  set value(nextValue: string) {
    void nextValue;
  },

  clear() {
    return undefined;
  },
};
`.trim();

  const violations = collectViolationsForTouchedObjectLiterals({
    filePath: "packages/demo/src/store.ts",
    source,
    addedLines: new Set([10])
  });

  assert.deepEqual(
    violations.map((item) => `${item.objectLabel}.${item.propertyName}`),
    ["store.clear"]
  );
});

test("skips non-js-ts source files instead of trying to parse them", () => {
  const violations = collectViolationsForTouchedObjectLiterals({
    filePath: "packages/demo/src/hermes-acp-route-bridge/sitecustomize.py",
    source: "def hello():\n    return 'world'\n",
    addedLines: new Set([1])
  });

  assert.deepEqual(violations, []);
});

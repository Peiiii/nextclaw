import assert from "node:assert/strict";
import test from "node:test";

import { collectViolationsForTouchedClasses } from "./lint-new-code-class-methods.mjs";

test("reports every eligible non-arrow instance method inside a touched class", () => {
  const source = `
class ExampleManager {
  load() {
    return "load";
  }

  save() {
    return "save";
  }

  helper = () => "ok";
}
`.trim();

  const violations = collectViolationsForTouchedClasses({
    filePath: "packages/demo/src/example-manager.ts",
    source,
    addedLines: new Set([6])
  });

  assert.deepEqual(
    violations.map((item) => `${item.className}.${item.methodName}`),
    ["ExampleManager.load", "ExampleManager.save"]
  );
});

test("does not report untouched classes in the same file", () => {
  const source = `
class UntouchedManager {
  load() {
    return "load";
  }
}

class TouchedManager {
  run() {
    return "run";
  }

  execute = () => "execute";
}
`.trim();

  const violations = collectViolationsForTouchedClasses({
    filePath: "packages/demo/src/mixed-manager.ts",
    source,
    addedLines: new Set([8])
  });

  assert.deepEqual(
    violations.map((item) => `${item.className}.${item.methodName}`),
    ["TouchedManager.run"]
  );
});

test("keeps existing ignore rules when scanning a touched class", () => {
  const source = `
class ScopedManager {
  constructor() {}

  get value() {
    return "value";
  }

  set value(nextValue: string) {
    void nextValue;
  }

  run() {
    return "run";
  }

  static boot() {
    return "boot";
  }
}
`.trim();

  const violations = collectViolationsForTouchedClasses({
    filePath: "packages/demo/src/scoped-manager.ts",
    source,
    addedLines: new Set([12])
  });

  assert.deepEqual(
    violations.map((item) => `${item.className}.${item.methodName}`),
    ["ScopedManager.run"]
  );
});

test("skips non-js-ts source files instead of trying to parse them", () => {
  const violations = collectViolationsForTouchedClasses({
    filePath: "packages/demo/src/hermes-acp-route-bridge/sitecustomize.py",
    source: "def hello():\n    return 'world'\n",
    addedLines: new Set([1])
  });

  assert.deepEqual(violations, []);
});

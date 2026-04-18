import test from "node:test";
import assert from "node:assert/strict";

import { summarizeRepoLineChanges } from "./maintainability-guard-line-changes.mjs";

test("summarizeRepoLineChanges excludes test files from non-test totals", () => {
  const summary = summarizeRepoLineChanges({
    diffNumstatOutput: [
      "10\t3\tpackages/demo/src/chat.service.ts",
      "4\t1\tpackages/demo/src/chat.service.test.ts"
    ].join("\n"),
    statusOutput: ""
  });

  assert.deepEqual(summary.total, { added: 14, deleted: 4, net: 10 });
  assert.deepEqual(summary.non_test, { added: 10, deleted: 3, net: 7 });
});

test("summarizeRepoLineChanges counts untracked files", () => {
  const contents = new Map([
    ["packages/demo/src/new.service.ts", "a\nb\nc"],
    ["packages/demo/src/new.service.test.ts", "a\nb"]
  ]);

  const summary = summarizeRepoLineChanges({
    diffNumstatOutput: "",
    statusOutput: [
      "?? packages/demo/src/new.service.ts",
      "?? packages/demo/src/new.service.test.ts"
    ].join("\n"),
    readFileTextImpl: (pathText) => contents.get(pathText) ?? ""
  });

  assert.deepEqual(summary.total, { added: 5, deleted: 0, net: 5 });
  assert.deepEqual(summary.non_test, { added: 3, deleted: 0, net: 3 });
});

test("summarizeRepoLineChanges respects scoped paths", () => {
  const summary = summarizeRepoLineChanges({
    candidatePaths: ["packages/demo/src/chat.service.ts"],
    diffNumstatOutput: [
      "10\t3\tpackages/demo/src/chat.service.ts",
      "20\t5\tpackages/demo/src/other.service.ts"
    ].join("\n"),
    statusOutput: ""
  });

  assert.deepEqual(summary.total, { added: 10, deleted: 3, net: 7 });
  assert.deepEqual(summary.non_test, { added: 10, deleted: 3, net: 7 });
  assert.deepEqual(summary.code_paths, ["packages/demo/src/chat.service.ts"]);
});

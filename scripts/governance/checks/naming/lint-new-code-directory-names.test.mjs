import assert from "node:assert/strict";
import test from "node:test";

import { collectDirectoryNameViolations } from "./lint-new-code-directory-names.mjs";

test("blocks touched files whose parent directory is not kebab-case", () => {
  const violations = collectDirectoryNameViolations([
    "packages/demo/src/BadDirectory/chat.service.ts"
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].level, "error");
  assert.match(violations[0].message, /BadDirectory/);
  assert.equal(violations[0].filePath, "packages/demo/src/BadDirectory");
});

test("allows versioned and dated docs directories", () => {
  const violations = collectDirectoryNameViolations([
    "docs/logs/2026-04-14-directory-governance/v0.16.15-directory-governance/README.md"
  ]);

  assert.deepEqual(violations, []);
});

test("allows approved hidden governance directories", () => {
  const violations = collectDirectoryNameViolations([
    ".agents/skills/post-edit-maintainability-guard/SKILL.md"
  ]);

  assert.deepEqual(violations, []);
});

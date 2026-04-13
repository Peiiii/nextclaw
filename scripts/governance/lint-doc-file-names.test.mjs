import assert from "node:assert/strict";
import test from "node:test";

import { collectDocFileNameDiffViolations } from "./lint-doc-file-names.mjs";

test("blocks new doc files whose names are not kebab-case", () => {
  const violations = collectDocFileNameDiffViolations([
    {
      filePath: "docs/plans/RuntimeControlPlan.md",
      status: "A"
    }
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].level, "error");
  assert.match(violations[0].message, /new or renamed doc file name is not kebab-case/);
  assert.equal(violations[0].suggestedPath, "docs/plans/runtime-control-plan.md");
});

test("warns when a touched legacy doc file is outside strict touched governance", () => {
  const violations = collectDocFileNameDiffViolations([
    {
      filePath: "docs/logs/legacy-batch/CHANGELOG.md",
      status: "M"
    },
    {
      filePath: "docs/designs/RuntimeControlPlan.md",
      status: "M"
    }
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].level, "warn");
  assert.match(violations[0].message, /touched legacy doc file name is still not kebab-case/);
});

test("blocks touched legacy doc files inside strict touched governance", () => {
  const violations = collectDocFileNameDiffViolations([
    {
      filePath: "docs/plans/RuntimeControlPlan.md",
      status: "M"
    }
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].level, "error");
  assert.match(violations[0].message, /strict touched-legacy governance/);
});

test("allows exact doc stem exceptions", () => {
  const violations = collectDocFileNameDiffViolations([
    {
      filePath: "docs/logs/v0.0.1-demo/README.md",
      status: "A"
    }
  ]);

  assert.deepEqual(violations, []);
});

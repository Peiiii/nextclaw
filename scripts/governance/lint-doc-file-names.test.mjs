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
  assert.match(violations[0].message, /new or renamed doc file name is not governed/);
  assert.equal(violations[0].suggestedPath, "docs/plans/YYYY-MM-DD-runtime-control-plan.md");
});

test("blocks touched legacy doc files too", () => {
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
  assert.equal(violations[0].level, "error");
  assert.match(violations[0].message, /touched doc file name is not governed/);
});

test("blocks design and plan docs without date prefixes", () => {
  const violations = collectDocFileNameDiffViolations([
    {
      filePath: "docs/designs/runtime-control-design.md",
      status: "A"
    },
    {
      filePath: "docs/plans/runtime-control-plan.md",
      status: "A"
    }
  ]);

  assert.equal(violations.length, 2);
  assert.match(violations[0].message, /must start with 'YYYY-MM-DD-'/);
  assert.equal(violations[0].suggestedPath, "docs/designs/YYYY-MM-DD-runtime-control-design.md");
  assert.equal(violations[1].suggestedPath, "docs/plans/YYYY-MM-DD-runtime-control-plan.md");
});

test("allows date-prefixed design and plan docs", () => {
  const violations = collectDocFileNameDiffViolations([
    {
      filePath: "docs/designs/2026-05-09-runtime-control-design.md",
      status: "A"
    },
    {
      filePath: "docs/plans/2026-05-09-runtime-control-plan.md",
      status: "A"
    }
  ]);

  assert.deepEqual(violations, []);
});

test("allows SKILL docs under governed .agents roots", () => {
  const violations = collectDocFileNameDiffViolations([
    {
      filePath: ".agents/skills/file-naming-convention/SKILL.md",
      status: "M"
    }
  ]);

  assert.deepEqual(violations, []);
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

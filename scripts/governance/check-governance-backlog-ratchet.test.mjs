import assert from "node:assert/strict";
import test from "node:test";

import { evaluateGovernanceBacklogRatchet } from "./check-governance-backlog-ratchet.mjs";

test("passes when current counts are at or below baseline", () => {
  const evaluation = evaluateGovernanceBacklogRatchet({
    baseline: {
      metrics: {
        sourceFileNameViolations: 10,
        docFileNameViolations: 5
      }
    },
    current: {
      sourceFileNameViolations: 9,
      docFileNameViolations: 5
    }
  });

  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.findings.filter((item) => item.level === "error").length, 0);
});

test("fails when any governance backlog metric rises above baseline", () => {
  const evaluation = evaluateGovernanceBacklogRatchet({
    baseline: {
      metrics: {
        sourceFileNameViolations: 10,
        docFileNameViolations: 5
      }
    },
    current: {
      sourceFileNameViolations: 11,
      docFileNameViolations: 5
    }
  });

  assert.equal(evaluation.ok, false);
  assert.equal(evaluation.findings.filter((item) => item.level === "error").length, 1);
  assert.match(evaluation.findings[0].message, /exceeds baseline/);
});

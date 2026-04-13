#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { rootDir } from "./lint-new-code-governance-support.mjs";
import { collectDocFileNameViolations } from "./report-doc-file-name-violations.mjs";
import { collectWorkspaceFileNameViolations } from "./report-file-name-kebab-violations.mjs";
import { GOVERNANCE_BACKLOG_BASELINE_PATH } from "./touched-legacy-governance-contracts.mjs";

const usage = `Usage:
  node scripts/governance/check-governance-backlog-ratchet.mjs
  node scripts/governance/check-governance-backlog-ratchet.mjs --json

Checks that tracked governance backlog counts never rise above the recorded baseline.`;

const parseArgs = (argv) => {
  const options = {
    json: false
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(usage);
      process.exit(0);
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const loadBaseline = () => JSON.parse(
  fs.readFileSync(path.resolve(rootDir, GOVERNANCE_BACKLOG_BASELINE_PATH), "utf8")
);

export const collectCurrentGovernanceBacklog = () => ({
  sourceFileNameViolations: collectWorkspaceFileNameViolations({ trackedOnly: true }).length,
  docFileNameViolations: collectDocFileNameViolations({ trackedOnly: true }).length
});

export const evaluateGovernanceBacklogRatchet = ({ baseline, current }) => {
  const findings = [];
  for (const [metric, baselineValue] of Object.entries(baseline.metrics ?? {})) {
    const currentValue = current[metric];
    if (!Number.isFinite(currentValue)) {
      findings.push({
        metric,
        level: "error",
        message: `missing current metric '${metric}'`
      });
      continue;
    }
    if (currentValue > baselineValue) {
      findings.push({
        metric,
        level: "error",
        message: `current count ${currentValue} exceeds baseline ${baselineValue}`
      });
      continue;
    }
    findings.push({
      metric,
      level: "ok",
      message: `current count ${currentValue} is within baseline ${baselineValue}`
    });
  }

  return {
    ok: findings.every((item) => item.level !== "error"),
    findings
  };
};

const printHuman = ({ baseline, current, evaluation }) => {
  console.log("Governance backlog ratchet");
  console.log(`- baseline file: ${GOVERNANCE_BACKLOG_BASELINE_PATH}`);
  console.log(`- tracked source file-name violations: ${current.sourceFileNameViolations} (baseline ${baseline.metrics.sourceFileNameViolations})`);
  console.log(`- tracked doc file-name violations: ${current.docFileNameViolations} (baseline ${baseline.metrics.docFileNameViolations})`);

  const errors = evaluation.findings.filter((item) => item.level === "error");
  if (errors.length === 0) {
    console.log("- ratchet status: OK");
    return;
  }

  console.error("- ratchet status: FAILED");
  for (const finding of errors) {
    console.error(`- [${finding.metric}] ${finding.message}`);
  }
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const baseline = loadBaseline();
  const current = collectCurrentGovernanceBacklog();
  const evaluation = evaluateGovernanceBacklogRatchet({ baseline, current });

  if (options.json) {
    console.log(JSON.stringify({ baseline, current, evaluation }, null, 2));
  } else {
    printHuman({ baseline, current, evaluation });
  }

  process.exit(evaluation.ok ? 0 : 1);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

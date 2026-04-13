#!/usr/bin/env node
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { defaultSortByLocation, rootDir } from "./lint-new-code-governance-support.mjs";
import { inspectDocKebabFilePath, isGovernedDocFile } from "./doc-file-name-shared.mjs";
import { DOC_NAMING_ROOTS } from "./touched-legacy-governance-contracts.mjs";

const usage = `Usage:
  node scripts/governance/report-doc-file-name-violations.mjs
  node scripts/governance/report-doc-file-name-violations.mjs --json
  node scripts/governance/report-doc-file-name-violations.mjs --limit 50
  node scripts/governance/report-doc-file-name-violations.mjs --tracked-only

Scans governed documentation files, then reports legacy non-kebab document file names with suggested rename targets.`;

const parseArgs = (argv) => {
  const options = {
    json: false,
    limit: null,
    trackedOnly: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(usage);
      process.exit(0);
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--tracked-only") {
      options.trackedOnly = true;
      continue;
    }
    if (arg === "--limit") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --limit.");
      }
      options.limit = Number(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.limit != null && (!Number.isFinite(options.limit) || options.limit <= 0)) {
    throw new Error("--limit must be a positive number.");
  }

  return options;
};

const listGovernedDocFiles = (trackedOnly) => {
  const args = trackedOnly
    ? ["ls-files", "--cached", "--", ...DOC_NAMING_ROOTS]
    : ["ls-files", "--cached", "--others", "--exclude-standard", "--", ...DOC_NAMING_ROOTS];

  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(isGovernedDocFile);
};

export const collectDocFileNameViolations = ({ trackedOnly = false } = {}) => {
  const findings = listGovernedDocFiles(trackedOnly)
    .flatMap((filePath) => {
      const finding = inspectDocKebabFilePath(filePath);
      if (!finding) {
        return [];
      }
      return [{
        filePath,
        line: 1,
        column: 1,
        suggestedPath: finding.suggestedPath,
        reason: finding.reason
      }];
    });

  return defaultSortByLocation(findings);
};

const printTextReport = (violations, limit) => {
  const shownViolations = limit == null ? violations : violations.slice(0, limit);
  const directories = new Set(violations.map((item) => path.posix.dirname(item.filePath)));

  console.log("Doc file-name kebab-case legacy report");
  console.log(`- scanned violations: ${violations.length}`);
  console.log(`- affected directories: ${directories.size}`);

  if (violations.length === 0) {
    console.log("- no legacy non-kebab document file names found");
    return;
  }

  for (const violation of shownViolations) {
    console.log(`- ${violation.filePath} -> ${violation.suggestedPath}`);
  }

  if (limit != null && violations.length > limit) {
    console.log(`- ... ${violations.length - limit} more violation(s) omitted; rerun without --limit for the full list`);
  }
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const violations = collectDocFileNameViolations({ trackedOnly: options.trackedOnly });

  if (options.json) {
    console.log(JSON.stringify({
      violations_count: violations.length,
      violations: options.limit == null ? violations : violations.slice(0, options.limit)
    }, null, 2));
    return;
  }

  printTextReport(violations, options.limit);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

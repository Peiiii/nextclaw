#!/usr/bin/env node
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { defaultSortByLocation, isGovernedWorkspaceFile, rootDir } from "./lint-new-code-governance-support.mjs";
import { inspectKebabFilePath } from "./file-name-kebab-shared.mjs";

const usage = `Usage:
  node scripts/report-file-name-kebab-violations.mjs
  node scripts/report-file-name-kebab-violations.mjs --json
  node scripts/report-file-name-kebab-violations.mjs --limit 50

Scans tracked and untracked workspace source files, then reports legacy non-kebab file names with suggested rename targets.`;

const parseArgs = (argv) => {
  const options = {
    json: false,
    limit: null
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

export const collectWorkspaceFileNameViolations = () => {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", "apps", "packages", "workers", "scripts"],
    {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    }
  );

  const findings = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(isGovernedWorkspaceFile)
    .flatMap((filePath) => {
      const finding = inspectKebabFilePath(filePath);
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

  console.log("File-name kebab-case legacy report");
  console.log(`- scanned violations: ${violations.length}`);
  console.log(`- affected directories: ${directories.size}`);

  if (violations.length === 0) {
    console.log("- no legacy non-kebab file names found");
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
  const violations = collectWorkspaceFileNameViolations();

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

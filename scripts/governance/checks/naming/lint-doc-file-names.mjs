#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectDocKebabFilePath, isGovernedDocFile } from "../../shared/doc-file-name-shared.mjs";
import {
  defaultSortByLocation,
  parseDiffCheckArgs,
  runGit
} from "../lint-new-code-governance-support.mjs";
import { DOC_NAMING_ROOTS } from "../../shared/touched-legacy-governance-contracts.mjs";

const usage = `Usage:
  node scripts/governance/checks/naming/lint-doc-file-names.mjs
  node scripts/governance/checks/naming/lint-doc-file-names.mjs --staged
  node scripts/governance/checks/naming/lint-doc-file-names.mjs --base origin/main
  node scripts/governance/checks/naming/lint-doc-file-names.mjs -- docs apps/docs

Blocks changed governed documentation files whose file names are not kebab-case.
Thought, design, and plan docs under docs/thoughts, docs/designs, or docs/plans must also start with YYYY-MM-DD- and end with their role suffix (.thought, .design, or .plan).
Once a doc file is touched, legacy non-compliant names must be renamed in the same change.`;

const getNameStatusArgs = (pathArgs, options) => {
  if (options.baseRef) {
    return ["diff", "--name-status", "--find-renames", "--diff-filter=AMR", options.baseRef, "--", ...pathArgs];
  }
  if (options.staged) {
    return ["diff", "--cached", "--name-status", "--find-renames", "--diff-filter=AMR", "--", ...pathArgs];
  }
  return ["diff", "--name-status", "--find-renames", "--diff-filter=AMR", "HEAD", "--", ...pathArgs];
};

const collectUntrackedDocFiles = (pathArgs, options) => {
  if (options.staged) {
    return [];
  }

  return runGit(["ls-files", "--others", "--exclude-standard", "--", ...pathArgs], { allowFailure: true })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(isGovernedDocFile);
};

export const collectChangedDocFileEntries = (options) => {
  const pathArgs = options.paths.length > 0 ? options.paths : DOC_NAMING_ROOTS;
  const entryByFile = new Map();
  const nameStatusOutput = runGit(getNameStatusArgs(pathArgs, options), { allowFailure: true });
  const untrackedFiles = collectUntrackedDocFiles(pathArgs, options);

  for (const line of nameStatusOutput.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    const parts = trimmedLine.split("\t");
    const status = parts[0];
    const nextPath = status.startsWith("R") ? parts[2] : parts[1];
    if (!nextPath || !isGovernedDocFile(nextPath)) {
      continue;
    }

    entryByFile.set(nextPath, { filePath: nextPath, status: status.startsWith("R") ? "R" : status });
  }

  for (const filePath of untrackedFiles) {
    entryByFile.set(filePath, { filePath, status: "U" });
  }

  const entries = Array.from(entryByFile.values()).sort((left, right) => left.filePath.localeCompare(right.filePath));

  return {
    changedFiles: entries.map((item) => item.filePath),
    entries
  };
};

export const collectDocFileNameDiffViolations = (entries) => defaultSortByLocation(
  entries.flatMap((entry) => {
    const finding = inspectDocKebabFilePath(entry.filePath);
    if (!finding) {
      return [];
    }

    return [{
      filePath: entry.filePath,
      line: 1,
      column: 1,
      ownerLine: 1,
      status: entry.status,
      level: "error",
      suggestedPath: finding.suggestedPath,
      message: entry.status === "M"
        ? `touched doc file name is not governed (${finding.reason}); rename to '${finding.suggestedPath}' before continuing`
        : `new or renamed doc file name is not governed (${finding.reason}); rename to '${finding.suggestedPath}'`
    }];
  })
);

export const runDocFileNameCheck = (options) => {
  const { changedFiles, entries } = collectChangedDocFileEntries(options);
  return {
    changedFiles,
    violations: collectDocFileNameDiffViolations(entries)
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed governed doc files to check.");
    return 0;
  }

  if (violations.length === 0) {
    console.log(`Doc file-name governance diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  console.error("Doc file-name governance diff check blocked changed files with non-compliant names.");
  for (const violation of violations) {
    console.error(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
  }
  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runDocFileNameCheck(options)));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

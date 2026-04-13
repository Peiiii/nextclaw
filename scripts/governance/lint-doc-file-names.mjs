#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectDocKebabFilePath, isGovernedDocFile } from "./doc-file-name-shared.mjs";
import {
  defaultSortByLocation,
  parseDiffCheckArgs,
  runGit
} from "./lint-new-code-governance-support.mjs";
import {
  DOC_NAMING_ROOTS,
  isPathWithinPrefixes,
  STRICT_TOUCHED_LEGACY_DOC_PATHS
} from "./touched-legacy-governance-contracts.mjs";

const usage = `Usage:
  node scripts/governance/lint-doc-file-names.mjs
  node scripts/governance/lint-doc-file-names.mjs --staged
  node scripts/governance/lint-doc-file-names.mjs --base origin/main
  node scripts/governance/lint-doc-file-names.mjs -- docs apps/docs

Blocks new or renamed governed documentation files whose file names are not kebab-case.
Warns when a touched legacy doc file still keeps a non-kebab file name unless the path is under strict touched-legacy governance.`;

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
    if (status.startsWith("R")) {
      const nextPath = parts[2];
      if (!nextPath || !isGovernedDocFile(nextPath)) {
        continue;
      }
      entryByFile.set(nextPath, { filePath: nextPath, status: "R" });
      continue;
    }

    const nextPath = parts[1];
    if (!nextPath || !isGovernedDocFile(nextPath)) {
      continue;
    }

    entryByFile.set(nextPath, { filePath: nextPath, status });
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

const isBlockingDocEntry = (entry) => (
  entry.status === "A" ||
  entry.status === "R" ||
  entry.status === "U" ||
  (entry.status === "M" && isPathWithinPrefixes(entry.filePath, STRICT_TOUCHED_LEGACY_DOC_PATHS))
);

export const collectDocFileNameDiffViolations = (entries) => defaultSortByLocation(
  entries.flatMap((entry) => {
    const finding = inspectDocKebabFilePath(entry.filePath);
    if (!finding) {
      return [];
    }

    const isBlocking = isBlockingDocEntry(entry);
    return [{
      filePath: entry.filePath,
      line: 1,
      column: 1,
      ownerLine: 1,
      status: entry.status,
      level: isBlocking ? "error" : "warn",
      suggestedPath: finding.suggestedPath,
      message: isBlocking
        ? entry.status === "M"
          ? `touched legacy doc file name is still not kebab-case (${finding.reason}) under strict touched-legacy governance; rename to '${finding.suggestedPath}'`
          : `new or renamed doc file name is not kebab-case (${finding.reason}); rename to '${finding.suggestedPath}'`
        : `touched legacy doc file name is still not kebab-case (${finding.reason}); rename to '${finding.suggestedPath}' when safe`
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

  const errors = violations.filter((item) => item.level === "error");
  const warnings = violations.filter((item) => item.level === "warn");

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`Doc file-name kebab-case diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  if (errors.length > 0) {
    console.error("Doc file-name kebab-case diff check blocked new/renamed files or strict touched legacy files with non-kebab names.");
    for (const violation of errors) {
      console.error(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
    }
  }

  if (warnings.length > 0) {
    const writer = errors.length > 0 ? console.error : console.log;
    writer("Legacy doc file-name kebab-case warnings:");
    for (const violation of warnings) {
      writer(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
    }
  }

  return errors.length > 0 ? 1 : 0;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runDocFileNameCheck(options)));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

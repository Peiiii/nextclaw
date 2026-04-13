#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectChangedWorkspaceFiles,
  defaultSortByLocation,
  isGovernedWorkspaceFile,
  parseDiffCheckArgs,
  runGit
} from "./lint-new-code-governance-support.mjs";
import { inspectKebabFilePath } from "./file-name-kebab-shared.mjs";
import {
  isPathWithinPrefixes,
  STRICT_TOUCHED_LEGACY_SOURCE_PATHS
} from "./touched-legacy-governance-contracts.mjs";

const usage = `Usage:
  node scripts/governance/lint-new-code-file-names.mjs
  node scripts/governance/lint-new-code-file-names.mjs --staged
  node scripts/governance/lint-new-code-file-names.mjs --base origin/main
  node scripts/governance/lint-new-code-file-names.mjs -- packages/nextclaw-ui/src

Blocks new or renamed workspace source files whose file names are not kebab-case.
Warns when a touched legacy file still keeps a non-kebab file name unless the path is under strict touched-legacy governance.`;

export const isBlockingFileNameEntry = (entry) => (
  entry.status === "A" ||
  entry.status === "R" ||
  entry.status === "U" ||
  (entry.status === "M" && isPathWithinPrefixes(entry.filePath, STRICT_TOUCHED_LEGACY_SOURCE_PATHS))
);

const getNameStatusArgs = (pathArgs, options) => {
  if (options.baseRef) {
    return ["diff", "--name-status", "--find-renames", "--diff-filter=AMR", options.baseRef, "--", ...pathArgs];
  }
  if (options.staged) {
    return ["diff", "--cached", "--name-status", "--find-renames", "--diff-filter=AMR", "--", ...pathArgs];
  }
  return ["diff", "--name-status", "--find-renames", "--diff-filter=AMR", "HEAD", "--", ...pathArgs];
};

export const collectChangedFileNameEntries = (options) => {
  const { pathArgs, changedFiles, untrackedFiles } = collectChangedWorkspaceFiles(options);
  const entryByFile = new Map();
  const nameStatusOutput = runGit(getNameStatusArgs(pathArgs, options), { allowFailure: true });

  for (const line of nameStatusOutput.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    const parts = trimmedLine.split("\t");
    const status = parts[0];
    if (status.startsWith("R")) {
      const nextPath = parts[2];
      if (!nextPath || !isGovernedWorkspaceFile(nextPath)) {
        continue;
      }
      entryByFile.set(nextPath, {
        filePath: nextPath,
        status: "R"
      });
      continue;
    }

    const nextPath = parts[1];
    if (!nextPath || !isGovernedWorkspaceFile(nextPath)) {
      continue;
    }

    entryByFile.set(nextPath, {
      filePath: nextPath,
      status
    });
  }

  for (const filePath of changedFiles) {
    if (!entryByFile.has(filePath)) {
      entryByFile.set(filePath, {
        filePath,
        status: untrackedFiles.includes(filePath) ? "U" : "M"
      });
    }
  }

  for (const filePath of untrackedFiles) {
    entryByFile.set(filePath, {
      filePath,
      status: "U"
    });
  }

  const entries = Array.from(entryByFile.values()).sort((left, right) => left.filePath.localeCompare(right.filePath));

  return {
    changedFiles: entries.map((item) => item.filePath),
    entries
  };
};

export const collectFileNameKebabViolations = (entries) => defaultSortByLocation(
  entries.flatMap((entry) => {
    const finding = inspectKebabFilePath(entry.filePath);
    if (!finding) {
      return [];
    }

    const isBlocking = isBlockingFileNameEntry(entry);
    const suggestedPath = finding.suggestedPath;

    return [{
      filePath: entry.filePath,
      line: 1,
      column: 1,
      ownerLine: 1,
      status: entry.status,
      level: isBlocking ? "error" : "warn",
      suggestedPath,
      message: isBlocking
        ? entry.status === "M"
          ? `touched legacy file name is still not kebab-case (${finding.reason}) under strict touched-legacy governance; rename to '${suggestedPath}'`
          : `new or renamed file name is not kebab-case (${finding.reason}); rename to '${suggestedPath}'`
        : `touched legacy file name is still not kebab-case (${finding.reason}); rename to '${suggestedPath}' when safe`
    }];
  })
);

export const runFileNameCheck = (options) => {
  const { changedFiles, entries } = collectChangedFileNameEntries(options);

  return {
    changedFiles,
    violations: collectFileNameKebabViolations(entries)
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed workspace source files to check.");
    return 0;
  }

  const errors = violations.filter((item) => item.level === "error");
  const warnings = violations.filter((item) => item.level === "warn");

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`File-name kebab-case diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  if (errors.length > 0) {
    console.error("File-name kebab-case diff check blocked new/renamed files or strict touched legacy files with non-kebab names.");
    for (const violation of errors) {
      console.error(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
    }
  }

  if (warnings.length > 0) {
    const writer = errors.length > 0 ? console.error : console.log;
    writer("Legacy file-name kebab-case warnings:");
    for (const violation of warnings) {
      writer(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
    }
  }

  return errors.length > 0 ? 1 : 0;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runFileNameCheck(options)));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

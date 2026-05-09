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

const usage = `Usage:
  node scripts/governance/lint-new-code-file-names.mjs
  node scripts/governance/lint-new-code-file-names.mjs --staged
  node scripts/governance/lint-new-code-file-names.mjs --base origin/main
  node scripts/governance/lint-new-code-file-names.mjs -- packages/nextclaw-ui/src

Blocks changed workspace source files whose file names are not kebab-case.
Once a file is touched, legacy non-kebab names must be renamed in the same change.`;

export const isBlockingFileNameEntry = (entry) => (
  entry.status === "A" ||
  entry.status === "R" ||
  entry.status === "U" ||
  entry.status === "M"
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
      const previousPath = parts[1];
      const nextPath = parts[2];
      if (!nextPath || !isGovernedWorkspaceFile(nextPath)) {
        continue;
      }
      entryByFile.set(nextPath, {
        filePath: nextPath,
        oldFilePath: previousPath,
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

    const suggestedPath = finding.suggestedPath;

    return [{
      filePath: entry.filePath,
      line: 1,
      column: 1,
      ownerLine: 1,
      status: entry.status,
      level: "error",
      suggestedPath,
      message: entry.status === "M"
        ? `touched file name is not kebab-case (${finding.reason}); rename to '${suggestedPath}' before continuing`
        : `new or renamed file name is not kebab-case (${finding.reason}); rename to '${suggestedPath}'`
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

  if (violations.length === 0) {
    console.log(`File-name kebab-case diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  console.error("File-name kebab-case diff check blocked changed files with non-kebab names.");
  for (const violation of violations) {
    console.error(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
  }
  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runFileNameCheck(options)));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

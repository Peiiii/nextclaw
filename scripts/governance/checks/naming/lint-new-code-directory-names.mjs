#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectChangedWorkspaceFiles,
  defaultSortByLocation,
  parseDiffCheckArgs
} from "../lint-new-code-governance-support.mjs";
import { collectChangedDocFileEntries } from "./lint-doc-file-names.mjs";
import { collectDirectoryNameViolationsForFilePath } from "../../shared/directory-name-kebab-shared.mjs";

const usage = `Usage:
  node scripts/governance/checks/naming/lint-new-code-directory-names.mjs
  node scripts/governance/checks/naming/lint-new-code-directory-names.mjs --staged
  node scripts/governance/checks/naming/lint-new-code-directory-names.mjs --base origin/main
  node scripts/governance/checks/naming/lint-new-code-directory-names.mjs -- packages/nextclaw-ui/src

Blocks touched files whose parent directory chain contains non-governed directory names.
Touched directories must use kebab-case, except for explicit version/date conventions and approved technical directories.`;

export const collectDirectoryNameViolations = (changedFiles) => defaultSortByLocation(
  changedFiles.flatMap((filePath) => collectDirectoryNameViolationsForFilePath(filePath).map((violation) => ({
    filePath: violation.directoryPath,
    line: 1,
    column: 1,
    ownerLine: 1,
    level: "error",
    message: `touched parent directory '${violation.directoryPath}' uses non-governed segment '${violation.segment}'; rename touched directories to kebab-case (version/date directories may use 'v<semver>-<slug>' or 'YYYY-MM-DD-<slug>')`
  })))
);

export const runDirectoryNameCheck = (options) => {
  const { changedFiles: sourceChangedFiles } = collectChangedWorkspaceFiles(options);
  const { changedFiles: docChangedFiles } = collectChangedDocFileEntries(options);
  const changedFiles = Array.from(new Set([...sourceChangedFiles, ...docChangedFiles]))
    .sort((left, right) => left.localeCompare(right));

  return {
    changedFiles,
    violations: collectDirectoryNameViolations(changedFiles)
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed governed files to check.");
    return 0;
  }

  if (violations.length === 0) {
    console.log(`Directory-name kebab-case diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  console.error("Directory-name kebab-case diff check blocked touched files whose parent directories are not governed.");
  for (const violation of violations) {
    console.error(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
  }
  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runDirectoryNameCheck(options)));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectChangedWorkspaceFiles,
  defaultSortByLocation,
  parseDiffCheckArgs
} from "./lint-new-code-governance-support.mjs";
import { collectFileDirectoryBasenameCollisions } from "./file-directory-basename-collision-shared.mjs";

const usage = `Usage:
  node scripts/governance/lint-new-code-file-directory-collisions.mjs
  node scripts/governance/lint-new-code-file-directory-collisions.mjs --staged
  node scripts/governance/lint-new-code-file-directory-collisions.mjs --base origin/main
  node scripts/governance/lint-new-code-file-directory-collisions.mjs -- packages/nextclaw-ui/src

Blocks touched workspace files whose basename collides with a sibling directory in the same parent path.`;

export const collectFileDirectoryCollisionViolations = (changedFiles, options = {}) => defaultSortByLocation(
  collectFileDirectoryBasenameCollisions(changedFiles, options).map((collision) => ({
    filePath: collision.filePath,
    line: 1,
    column: 1,
    ownerLine: 1,
    level: "error",
    message: `file basename collides with sibling directory '${collision.directoryPath}'; rename one side to keep the module boundary unambiguous`
  }))
);

export const runFileDirectoryCollisionCheck = (options) => {
  const { changedFiles } = collectChangedWorkspaceFiles(options);
  if (changedFiles.length === 0) {
    return {
      changedFiles,
      violations: []
    };
  }

  return {
    changedFiles,
    violations: collectFileDirectoryCollisionViolations(changedFiles)
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed workspace source files to check.");
    return 0;
  }

  if (violations.length === 0) {
    console.log(`File-directory collision diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  console.error("File-directory collision diff check blocked touched files that shadow a sibling directory basename.");
  for (const violation of violations) {
    console.error(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
  }
  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runFileDirectoryCollisionCheck(options)));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

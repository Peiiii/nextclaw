#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectChangedWorkspaceFiles,
  defaultSortByLocation,
  parseDiffCheckArgs,
  rootDir,
  toPosixPath
} from "./lint-new-code-governance-support.mjs";

const usage = `Usage:
  node scripts/lint-new-code-frozen-directories.mjs
  node scripts/lint-new-code-frozen-directories.mjs --staged
  node scripts/lint-new-code-frozen-directories.mjs --base origin/main
  node scripts/lint-new-code-frozen-directories.mjs -- packages/nextclaw-core/src/agent

Blocks changes under explicitly frozen directories while they still exceed their direct-file budget.`;

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".py", ".sh"]);

export const FROZEN_DIRECTORY_RULES = [
  {
    directoryPath: "packages/nextclaw-core/src/agent",
    maxDirectCodeFiles: 12,
    reason: "agent 根目录已经堆到 24 个直接代码文件，后续改动必须先把职责拆进子树，而不是继续在扁平根目录里演进。"
  }
];

const normalizePath = (value) => {
  const normalized = `${value ?? ""}`.trim();
  if (!normalized) {
    return "";
  }
  return toPosixPath(normalized).replace(/^\.\/+/, "").replace(/\/+$/, "");
};

const isCodeFile = (filePath) => {
  const normalized = normalizePath(filePath);
  if (!normalized || normalized.endsWith(".d.ts")) {
    return false;
  }
  return CODE_EXTENSIONS.has(path.posix.extname(normalized).toLowerCase());
};

const listDirectCodeFiles = (directoryPath) => {
  const normalized = normalizePath(directoryPath);
  if (!normalized) {
    return [];
  }

  const absolutePath = path.resolve(rootDir, normalized);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
    return [];
  }

  return fs.readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => normalizePath(path.posix.join(normalized, entry.name)))
    .filter(isCodeFile)
    .sort();
};

const isPathWithinDirectory = (filePath, directoryPath) => {
  const normalizedFile = normalizePath(filePath);
  const normalizedDirectory = normalizePath(directoryPath);
  return Boolean(normalizedFile && normalizedDirectory) && (
    normalizedFile === normalizedDirectory || normalizedFile.startsWith(`${normalizedDirectory}/`)
  );
};

export const evaluateFrozenDirectoryViolation = (params) => {
  const {
    rule,
    changedFiles,
    currentDirectCodeFileCount
  } = params;

  const touchedFiles = changedFiles
    .map((filePath) => normalizePath(filePath))
    .filter((filePath) => isPathWithinDirectory(filePath, rule.directoryPath));

  if (touchedFiles.length === 0) {
    return null;
  }

  if (currentDirectCodeFileCount < rule.maxDirectCodeFiles) {
    return null;
  }

  return {
    filePath: rule.directoryPath,
    line: 1,
    column: 1,
    ownerLine: 1,
    level: "error",
    message: `touching this frozen directory is blocked while it still has ${currentDirectCodeFileCount} direct code files (budget ${rule.maxDirectCodeFiles}); split responsibilities into subtrees before changing files here`,
    reason: rule.reason,
    touchedFiles
  };
};

export const collectFrozenDirectoryViolations = (changedFiles) => {
  const violations = [];

  for (const rule of FROZEN_DIRECTORY_RULES) {
    const violation = evaluateFrozenDirectoryViolation({
      rule,
      changedFiles,
      currentDirectCodeFileCount: listDirectCodeFiles(rule.directoryPath).length
    });
    if (violation) {
      violations.push(violation);
    }
  }

  return defaultSortByLocation(violations, "ownerLine");
};

export const runFrozenDirectoryCheck = (options) => {
  const { changedFiles } = collectChangedWorkspaceFiles(options);
  if (changedFiles.length === 0) {
    return { changedFiles, violations: [] };
  }

  return {
    changedFiles,
    violations: collectFrozenDirectoryViolations(changedFiles)
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed TypeScript workspace files to check.");
    return 0;
  }

  if (violations.length === 0) {
    console.log(`Frozen-directory diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  console.error("Frozen-directory diff check blocked changes in directories that must be split before further edits.");
  for (const violation of violations) {
    console.error(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
    if (violation.reason) {
      console.error(`  reason: ${violation.reason}`);
    }
    for (const touchedFile of violation.touchedFiles ?? []) {
      console.error(`  touched: ${touchedFile}`);
    }
  }
  return 1;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runFrozenDirectoryCheck(options)));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

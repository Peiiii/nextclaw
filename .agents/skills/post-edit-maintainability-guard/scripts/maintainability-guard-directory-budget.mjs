import path from "node:path";

import {
  ROOT,
  isCodePath,
  normalizePath,
  runGit
} from "./maintainability-guard-support.mjs";
export {
  DIRECTORY_BUDGET_ERROR_COUNT,
  DIRECTORY_BUDGET_EXCEPTION_REQUIRED_FIELDS,
  DIRECTORY_BUDGET_EXCEPTION_SECTION_TITLE,
  DIRECTORY_BUDGET_WARNING_COUNT,
  evaluateDirectoryBudget,
  inspectDirectoryBudgetExceptionText
} from "../../../../scripts/governance/maintainability-directory-budget.mjs";
import {
  evaluateDirectoryBudget,
  inspectDirectoryBudgetException,
  listDirectCodeFilesInDirectory
} from "../../../../scripts/governance/maintainability-directory-budget.mjs";

function dirnamePosix(pathText) {
  const normalized = normalizePath(pathText);
  if (!normalized) {
    return "";
  }
  const parent = path.posix.dirname(normalized);
  return parent === "." ? "" : parent;
}

function listHeadDirectCodeFilesInDirectory(directoryPath) {
  const normalized = normalizePath(directoryPath);
  if (!normalized) {
    return [];
  }

  const output = runGit(["ls-tree", "-r", "--name-only", "HEAD", "--", normalized], false);
  if (!output.trim()) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((filePath) => normalizePath(filePath))
    .filter((filePath) => filePath && path.posix.dirname(filePath) === normalized && isCodePath(filePath))
    .sort();
}

export function collectDirectoryBudgetFindings(paths) {
  const touchedDirectories = new Set();

  for (const rawPath of paths) {
    const directoryPath = dirnamePosix(rawPath);
    if (directoryPath) {
      touchedDirectories.add(directoryPath);
    }
  }

  return [...touchedDirectories]
    .sort()
    .map((directoryPath) => evaluateDirectoryBudget({
      directoryPath,
      currentCount: listDirectCodeFilesInDirectory({ rootDir: ROOT, directoryPath, isCodePath }).length,
      previousCount: (() => {
        const previousFiles = listHeadDirectCodeFilesInDirectory(directoryPath);
        return previousFiles.length === 0 ? 0 : previousFiles.length;
      })(),
      exception: inspectDirectoryBudgetException({ rootDir: ROOT, directoryPath })
    }))
    .filter(Boolean);
}

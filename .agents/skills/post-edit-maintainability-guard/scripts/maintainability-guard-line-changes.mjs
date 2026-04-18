import fs from "node:fs";
import path from "node:path";

import {
  ROOT,
  countLinesInText,
  isCodePath,
  isTestPath,
  listCodeFilesUnder,
  normalizePath,
  readFileText,
  runGit
} from "./maintainability-guard-support.mjs";

function createLineChangeBucket() {
  return {
    added: 0,
    deleted: 0,
    net: 0
  };
}

function updateLineChangeBucket(bucket, added, deleted) {
  bucket.added += added;
  bucket.deleted += deleted;
  bucket.net = bucket.added - bucket.deleted;
}

function resolveStatusPaths(payload) {
  const normalized = normalizePath(payload);
  if (!normalized) {
    return [];
  }
  const absolutePath = path.resolve(ROOT, normalized);
  if (!fs.existsSync(absolutePath)) {
    return [normalized];
  }
  if (fs.statSync(absolutePath).isDirectory()) {
    return listCodeFilesUnder(normalized);
  }
  return [normalized];
}

function shouldIncludeLineChangePath(pathText, scopeSet) {
  if (!pathText || !isCodePath(pathText)) {
    return false;
  }
  if (!scopeSet) {
    return true;
  }
  return scopeSet.has(normalizePath(pathText));
}

export function summarizeRepoLineChanges({
  candidatePaths = null,
  diffNumstatOutput = null,
  statusOutput = null,
  readFileTextImpl = readFileText
} = {}) {
  const scopeSet = candidatePaths && candidatePaths.length > 0
    ? new Set(candidatePaths.map((entry) => normalizePath(entry)).filter(Boolean))
    : null;
  const trackedPaths = new Set();
  const untrackedPaths = new Set();
  const codePaths = new Set();
  const nonTestPaths = new Set();
  const total = createLineChangeBucket();
  const nonTest = createLineChangeBucket();

  const appendPathStats = (pathText, added, deleted) => {
    codePaths.add(pathText);
    updateLineChangeBucket(total, added, deleted);
    if (!isTestPath(pathText)) {
      nonTestPaths.add(pathText);
      updateLineChangeBucket(nonTest, added, deleted);
    }
  };

  const diffOutput = diffNumstatOutput ?? runGit(["diff", "--numstat", "--find-renames", "HEAD"], false);
  for (const line of diffOutput.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const columns = line.split("\t");
    if (columns.length < 3) {
      continue;
    }
    const [addedText, deletedText, ...pathColumns] = columns;
    if (addedText === "-" || deletedText === "-") {
      continue;
    }
    const pathText = normalizePath(pathColumns[pathColumns.length - 1]);
    if (!shouldIncludeLineChangePath(pathText, scopeSet)) {
      continue;
    }
    trackedPaths.add(pathText);
    appendPathStats(pathText, Number(addedText), Number(deletedText));
  }

  const porcelain = statusOutput ?? runGit(["status", "--porcelain"], false);
  for (const line of porcelain.split(/\r?\n/)) {
    if (!line.startsWith("?? ")) {
      continue;
    }
    for (const pathText of resolveStatusPaths(line.slice(3))) {
      if (!shouldIncludeLineChangePath(pathText, scopeSet) || trackedPaths.has(pathText) || untrackedPaths.has(pathText)) {
        continue;
      }
      let added = 0;
      try {
        added = countLinesInText(readFileTextImpl(pathText));
      } catch {
        continue;
      }
      untrackedPaths.add(pathText);
      appendPathStats(pathText, added, 0);
    }
  }

  return {
    total,
    non_test: nonTest,
    code_paths: [...codePaths].sort(),
    non_test_paths: [...nonTestPaths].sort(),
    has_code_changes: codePaths.size > 0
  };
}

import fs from "node:fs";
import path from "node:path";

export const DIRECTORY_BUDGET_WARNING_COUNT = 12;
export const DIRECTORY_BUDGET_ERROR_COUNT = 12;
export const DIRECTORY_BUDGET_EXCEPTION_SECTION_TITLE = "## 目录预算豁免";
export const DIRECTORY_BUDGET_EXCEPTION_REQUIRED_FIELDS = ["原因"];

const DIRECTORY_BUDGET_CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".py",
  ".sh"
]);

const DIRECTORY_BUDGET_IGNORED_PARTS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".vite",
  ".vitepress",
  "out",
  "tmp",
  "ui-dist",
  "release"
]);

const DIRECTORY_BUDGET_EXCLUDED_PARTS = new Set([
  "__tests__",
  "tests",
  "__fixtures__",
  "fixtures",
  "generated",
  "migrations"
]);

function toPosixPath(input) {
  return input.split(path.sep).join(path.posix.sep);
}

export function normalizeDirectoryBudgetPath(pathText) {
  const normalized = `${pathText ?? ""}`.trim();
  if (!normalized) {
    return "";
  }
  return toPosixPath(normalized).replace(/^\.\/+/, "").replace(/\/+$/, "");
}

export function isDirectoryBudgetCodePath(pathText) {
  const normalized = normalizeDirectoryBudgetPath(pathText);
  if (!normalized) {
    return false;
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => DIRECTORY_BUDGET_IGNORED_PARTS.has(part))) {
    return false;
  }
  return DIRECTORY_BUDGET_CODE_EXTENSIONS.has(path.posix.extname(normalized).toLowerCase());
}

export function shouldCheckDirectoryBudget(directoryPath) {
  const normalized = normalizeDirectoryBudgetPath(directoryPath);
  if (!normalized) {
    return false;
  }
  const parts = normalized.split("/").filter(Boolean);
  return !parts.some(
    (part) =>
      DIRECTORY_BUDGET_IGNORED_PARTS.has(part.toLowerCase()) || DIRECTORY_BUDGET_EXCLUDED_PARTS.has(part.toLowerCase())
  );
}

export function listDirectCodeFilesInDirectory(params) {
  const {
    rootDir,
    directoryPath,
    isCodePath = isDirectoryBudgetCodePath
  } = params;
  const normalized = normalizeDirectoryBudgetPath(directoryPath);
  if (!normalized || !shouldCheckDirectoryBudget(normalized)) {
    return [];
  }

  const absolutePath = path.resolve(rootDir, normalized);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
    return [];
  }

  return fs.readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => normalizeDirectoryBudgetPath(path.posix.join(normalized, entry.name)))
    .filter((filePath) => filePath && isCodePath(filePath))
    .sort();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function inspectDirectoryBudgetExceptionText(readmeText) {
  const lines = `${readmeText ?? ""}`.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === DIRECTORY_BUDGET_EXCEPTION_SECTION_TITLE);

  if (headingIndex === -1) {
    return {
      found: false,
      missingFields: [...DIRECTORY_BUDGET_EXCEPTION_REQUIRED_FIELDS],
      reason: null
    };
  }

  const blockLines = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^##\s/.test(line)) {
      break;
    }
    blockLines.push(line);
  }

  const blockText = blockLines.join("\n");
  const reasonMatch = blockText.match(
    new RegExp(`^-\\s*${escapeRegExp(DIRECTORY_BUDGET_EXCEPTION_REQUIRED_FIELDS[0])}\\s*[:：]\\s*(.+)$`, "m")
  );

  return {
    found: true,
    missingFields: reasonMatch ? [] : [...DIRECTORY_BUDGET_EXCEPTION_REQUIRED_FIELDS],
    reason: reasonMatch ? reasonMatch[1].trim() : null
  };
}

export function inspectDirectoryBudgetException(params) {
  const { rootDir, directoryPath } = params;
  const normalized = normalizeDirectoryBudgetPath(directoryPath);
  if (!normalized) {
    return {
      readmePath: null,
      found: false,
      missingFields: [...DIRECTORY_BUDGET_EXCEPTION_REQUIRED_FIELDS],
      reason: null
    };
  }

  const readmePath = `${normalized}/README.md`;
  const absoluteReadmePath = path.resolve(rootDir, readmePath);
  if (!fs.existsSync(absoluteReadmePath) || !fs.statSync(absoluteReadmePath).isFile()) {
    return {
      readmePath,
      found: false,
      missingFields: [...DIRECTORY_BUDGET_EXCEPTION_REQUIRED_FIELDS],
      reason: null
    };
  }

  const coverage = inspectDirectoryBudgetExceptionText(fs.readFileSync(absoluteReadmePath, "utf8"));
  return {
    readmePath,
    found: coverage.found,
    missingFields: coverage.missingFields,
    reason: coverage.reason
  };
}

function createDirectoryBudgetEntry(params) {
  const {
    level,
    message,
    directoryPath,
    currentCount,
    previousCount = null,
    exception = null,
    scope
  } = params;
  const normalized = normalizeDirectoryBudgetPath(directoryPath);
  const hasCompleteException = Boolean(exception?.found) && (exception?.missingFields?.length ?? 0) === 0;

  return {
    level,
    source: "directory-budget",
    path: normalized,
    scope,
    category: "directory",
    budget: DIRECTORY_BUDGET_WARNING_COUNT === DIRECTORY_BUDGET_ERROR_COUNT
      ? `${DIRECTORY_BUDGET_ERROR_COUNT}`
      : `${DIRECTORY_BUDGET_WARNING_COUNT}/${DIRECTORY_BUDGET_ERROR_COUNT}`,
    message,
    suggested_seam: "split the directory by responsibility (for example components/store/service) before adding more direct files",
    current_count: currentCount,
    previous_count: previousCount,
    delta_count: previousCount == null ? null : currentCount - previousCount,
    exception_path: exception?.readmePath ?? null,
    exception_reason: exception?.reason ?? null,
    exception_status: hasCompleteException ? "complete" : exception?.found ? "incomplete" : "missing"
  };
}

export function evaluateDirectoryBudget(params) {
  const {
    directoryPath,
    currentCount,
    previousCount,
    exception
  } = params;

  if (currentCount < Math.min(DIRECTORY_BUDGET_WARNING_COUNT, DIRECTORY_BUDGET_ERROR_COUNT)) {
    return null;
  }

  const previous = previousCount ?? 0;
  const hasCompleteException = Boolean(exception?.found) && (exception?.missingFields?.length ?? 0) === 0;

  if (currentCount >= DIRECTORY_BUDGET_ERROR_COUNT) {
    if (hasCompleteException) {
      return createDirectoryBudgetEntry({
        level: "warn",
        message: `directory exceeds hard file-count budget with a recorded exception in ${exception.readmePath}`,
        directoryPath,
        currentCount,
        previousCount,
        exception,
        scope: "diff"
      });
    }

    if (exception?.found) {
      return createDirectoryBudgetEntry({
        level: "error",
        message: `directory exceeds hard file-count budget and its exception note is incomplete; missing=${exception.missingFields.join(", ")}`,
        directoryPath,
        currentCount,
        previousCount,
        exception,
        scope: "diff"
      });
    }

    if (previous < DIRECTORY_BUDGET_ERROR_COUNT) {
      return createDirectoryBudgetEntry({
        level: "error",
        message: "directory crossed from within budget to at or over the hard file-count limit without a recorded exception",
        directoryPath,
        currentCount,
        previousCount,
        exception,
        scope: "diff"
      });
    }

    return createDirectoryBudgetEntry({
      level: "warn",
      message: "directory remains at or over the hard file-count limit without a recorded exception",
      directoryPath,
      currentCount,
      previousCount,
      exception,
      scope: "diff"
    });
  }

  if (DIRECTORY_BUDGET_WARNING_COUNT >= DIRECTORY_BUDGET_ERROR_COUNT) {
    return null;
  }

  if (previousCount == null) {
    return createDirectoryBudgetEntry({
      level: "warn",
      message: "new directory starts above the review file-count budget",
      directoryPath,
      currentCount,
      previousCount,
      exception,
      scope: "diff"
    });
  }

  if (previous < DIRECTORY_BUDGET_WARNING_COUNT) {
    return createDirectoryBudgetEntry({
      level: "warn",
      message: "directory reached the review file-count budget; split by responsibility before it hardens into a dumping ground",
      directoryPath,
      currentCount,
      previousCount,
      exception,
      scope: "diff"
    });
  }

  if (currentCount > previous) {
    return createDirectoryBudgetEntry({
      level: "warn",
      message: "already crowded directory kept growing inside the review budget zone",
      directoryPath,
      currentCount,
      previousCount,
      exception,
      scope: "diff"
    });
  }

  return createDirectoryBudgetEntry({
    level: "warn",
    message: "touched directory remains above the review file-count budget",
    directoryPath,
    currentCount,
    previousCount,
    exception,
    scope: "diff"
  });
}

function createDirectoryBudgetSnapshotEntry(params) {
  const {
    directoryPath,
    currentCount,
    exception
  } = params;
  if (currentCount < Math.min(DIRECTORY_BUDGET_WARNING_COUNT, DIRECTORY_BUDGET_ERROR_COUNT)) {
    return null;
  }

  const hasCompleteException = Boolean(exception?.found) && (exception?.missingFields?.length ?? 0) === 0;
  if (currentCount >= DIRECTORY_BUDGET_ERROR_COUNT) {
    if (hasCompleteException) {
      return createDirectoryBudgetEntry({
        level: "warn",
        message: `directory exceeds hard file-count budget with a recorded exception in ${exception.readmePath}`,
        directoryPath,
        currentCount,
        exception,
        scope: "report"
      });
    }

    if (exception?.found) {
      return createDirectoryBudgetEntry({
        level: "error",
        message: `directory exceeds hard file-count budget and its exception note is incomplete; missing=${exception.missingFields.join(", ")}`,
        directoryPath,
        currentCount,
        exception,
        scope: "report"
      });
    }

    return createDirectoryBudgetEntry({
      level: "error",
      message: "directory exceeds hard file-count budget without a recorded exception",
      directoryPath,
      currentCount,
      exception,
      scope: "report"
    });
  }

  if (DIRECTORY_BUDGET_WARNING_COUNT >= DIRECTORY_BUDGET_ERROR_COUNT) {
    return null;
  }

  return createDirectoryBudgetEntry({
    level: "warn",
    message: "directory exceeds the review file-count budget",
    directoryPath,
    currentCount,
    exception,
    scope: "report"
  });
}

function collectDirectoryBudgetCandidates(params) {
  const {
    rootDir,
    currentDirectory,
    visited,
    isCodePath,
    onDirectory
  } = params;
  const normalized = normalizeDirectoryBudgetPath(currentDirectory);
  if (!normalized || visited.has(normalized) || !shouldCheckDirectoryBudget(normalized)) {
    return;
  }
  visited.add(normalized);

  const absoluteDirectory = path.resolve(rootDir, normalized);
  if (!fs.existsSync(absoluteDirectory) || !fs.statSync(absoluteDirectory).isDirectory()) {
    return;
  }

  onDirectory(normalized);

  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (DIRECTORY_BUDGET_IGNORED_PARTS.has(entry.name.toLowerCase())) {
      continue;
    }
    collectDirectoryBudgetCandidates({
      rootDir,
      currentDirectory: path.posix.join(normalized, entry.name),
      visited,
      isCodePath,
      onDirectory
    });
  }
}

export function collectDirectoryBudgetHotspots(params) {
  const {
    rootDir,
    scanRoots,
    isCodePath = isDirectoryBudgetCodePath
  } = params;
  const normalizedRoots = [...new Set(
    (scanRoots ?? [])
      .map((entry) => normalizeDirectoryBudgetPath(entry))
      .filter(Boolean)
  )].sort();

  const hotspots = [];
  const visited = new Set();
  let scannedDirectories = 0;

  for (const scanRoot of normalizedRoots) {
    collectDirectoryBudgetCandidates({
      rootDir,
      currentDirectory: scanRoot,
      visited,
      isCodePath,
      onDirectory: (directoryPath) => {
        scannedDirectories += 1;
        const currentCount = listDirectCodeFilesInDirectory({
          rootDir,
          directoryPath,
          isCodePath
        }).length;
        const snapshotEntry = createDirectoryBudgetSnapshotEntry({
          directoryPath,
          currentCount,
          exception: inspectDirectoryBudgetException({ rootDir, directoryPath })
        });
        if (snapshotEntry) {
          hotspots.push(snapshotEntry);
        }
      }
    });
  }

  hotspots.sort((left, right) => {
    if ((left.level === "error") !== (right.level === "error")) {
      return left.level === "error" ? -1 : 1;
    }
    if ((right.current_count ?? 0) !== (left.current_count ?? 0)) {
      return (right.current_count ?? 0) - (left.current_count ?? 0);
    }
    return left.path.localeCompare(right.path);
  });

  return {
    scannedRoots: normalizedRoots,
    scannedDirectories,
    totalHotspots: hotspots.length,
    hotspots,
    countsByLevel: {
      error: hotspots.filter((entry) => entry.level === "error").length,
      warn: hotspots.filter((entry) => entry.level === "warn").length
    }
  };
}

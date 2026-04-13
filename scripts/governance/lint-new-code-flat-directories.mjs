#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectChangedWorkspaceFiles,
  defaultSortByLocation,
  parseDiffCheckArgs,
  rootDir,
  runGit,
  toPosixPath
} from "./lint-new-code-governance-support.mjs";
import {
  isPathWithinPrefixes,
  STRICT_TOUCHED_FLAT_DIRECTORY_PATHS
} from "./touched-legacy-governance-contracts.mjs";

const usage = `Usage:
  node scripts/governance/lint-new-code-flat-directories.mjs
  node scripts/governance/lint-new-code-flat-directories.mjs --staged
  node scripts/governance/lint-new-code-flat-directories.mjs --base origin/main
  node scripts/governance/lint-new-code-flat-directories.mjs -- packages/nextclaw/src

Checks touched directories that keep growing as flat mixed-responsibility directories.
If a touched directory has too many direct code files, almost no subtree, and multiple role clusters, split it by responsibility or record an explicit subtree exception.`;

const TREE_EXCEPTION_SECTION_TITLE = "## 子树边界豁免";
const TREE_EXCEPTION_REQUIRED_FIELDS = ["原因"];
const IGNORED_PARTS = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", ".vite", ".vitepress", "out", "tmp", "ui-dist", "release"]);
const EXCLUDED_PARTS = new Set(["__tests__", "tests", "__fixtures__", "fixtures", "generated", "migrations"]);
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".py", ".sh"]);

const normalizeDirectoryPath = (pathText) => {
  const normalized = `${pathText ?? ""}`.trim();
  if (!normalized) {
    return "";
  }
  return toPosixPath(normalized).replace(/^\.\/+/, "").replace(/\/+$/, "");
};

const shouldCheckDirectory = (directoryPath) => {
  const normalized = normalizeDirectoryPath(directoryPath);
  if (!normalized) {
    return false;
  }
  const parts = normalized.split("/").filter(Boolean);
  return !parts.some((part) => IGNORED_PARTS.has(part.toLowerCase()) || EXCLUDED_PARTS.has(part.toLowerCase()));
};

const isCodeFile = (filePath) => {
  const normalized = normalizeDirectoryPath(filePath);
  if (!normalized) {
    return false;
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => IGNORED_PARTS.has(part.toLowerCase()))) {
    return false;
  }
  return CODE_EXTENSIONS.has(path.posix.extname(normalized).toLowerCase());
};

const listCurrentDirectoryShape = (directoryPath) => {
  const normalized = normalizeDirectoryPath(directoryPath);
  if (!normalized || !shouldCheckDirectory(normalized)) {
    return { directCodeFiles: [], directSubdirectories: [] };
  }

  const absolutePath = path.resolve(rootDir, normalized);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
    return { directCodeFiles: [], directSubdirectories: [] };
  }

  const directCodeFiles = [];
  const directSubdirectories = [];

  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    const entryPath = normalizeDirectoryPath(path.posix.join(normalized, entry.name));
    if (entry.isFile() && isCodeFile(entryPath)) {
      directCodeFiles.push(entryPath);
      continue;
    }
    if (entry.isDirectory() && !IGNORED_PARTS.has(entry.name.toLowerCase()) && !EXCLUDED_PARTS.has(entry.name.toLowerCase())) {
      directSubdirectories.push(entryPath);
    }
  }

  return {
    directCodeFiles: directCodeFiles.sort(),
    directSubdirectories: directSubdirectories.sort()
  };
};

const listHeadDirectoryShape = (directoryPath) => {
  const normalized = normalizeDirectoryPath(directoryPath);
  if (!normalized || !shouldCheckDirectory(normalized)) {
    return { directCodeFiles: [], directSubdirectories: [] };
  }

  const output = runGit(["ls-tree", "-r", "--name-only", "HEAD", "--", normalized], { allowFailure: true });
  if (!output.trim()) {
    return { directCodeFiles: [], directSubdirectories: [] };
  }

  const directCodeFiles = [];
  const directSubdirectories = new Set();

  for (const filePath of output.split(/\r?\n/).map((line) => normalizeDirectoryPath(line)).filter(Boolean)) {
    if (!filePath.startsWith(`${normalized}/`)) {
      continue;
    }
    if (path.posix.dirname(filePath) === normalized && isCodeFile(filePath)) {
      directCodeFiles.push(filePath);
      continue;
    }
    const remainder = filePath.slice(normalized.length + 1);
    const firstSegment = remainder.split("/")[0];
    if (firstSegment && !IGNORED_PARTS.has(firstSegment.toLowerCase()) && !EXCLUDED_PARTS.has(firstSegment.toLowerCase())) {
      directSubdirectories.add(path.posix.join(normalized, firstSegment));
    }
  }

  return {
    directCodeFiles: directCodeFiles.sort(),
    directSubdirectories: [...directSubdirectories].sort()
  };
};

const detectRole = (filePath) => {
  const basename = path.posix.basename(filePath, path.posix.extname(filePath)).toLowerCase();
  if (filePath.endsWith(".tsx") || /(page|panel|dialog|modal|component|view|form|input|card|sidebar)/.test(basename)) {
    return "ui";
  }
  if (/(service|manager|controller|runtime|orchestrator|presenter|bridge)/.test(basename)) {
    return "orchestration";
  }
  if (/(store|state|cache|queue|session|registry)/.test(basename)) {
    return "state";
  }
  if (/(adapter|api|client|server|provider|gateway|transport)/.test(basename)) {
    return "integration";
  }
  if (/(util|utils|helper|types|schema|constant|test)/.test(basename)) {
    return "support";
  }
  return "misc";
};

export const summarizeDirectoryTreeSignals = ({ directCodeFiles, directSubdirectories }) => {
  const roleBuckets = new Set(
    directCodeFiles
      .map((filePath) => detectRole(filePath))
      .filter((role) => role !== "support" && role !== "misc")
  );

  return {
    directFileCount: directCodeFiles.length,
    directSubdirectoryCount: directSubdirectories.length,
    roleBuckets,
    needsSubtree: directCodeFiles.length >= 8 && directSubdirectories.length <= 1 && roleBuckets.size >= 3
  };
};

const inspectTreeExceptionText = (readmeText) => {
  const lines = `${readmeText ?? ""}`.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === TREE_EXCEPTION_SECTION_TITLE);
  if (headingIndex === -1) {
    return {
      found: false,
      missingFields: [...TREE_EXCEPTION_REQUIRED_FIELDS],
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

  const match = blockLines.join("\n").match(/-\s*原因\s*[:：]\s*(.+)$/m);
  return {
    found: true,
    missingFields: match ? [] : [...TREE_EXCEPTION_REQUIRED_FIELDS],
    reason: match ? match[1].trim() : null
  };
};

const inspectTreeException = (directoryPath) => {
  const normalized = normalizeDirectoryPath(directoryPath);
  const readmePath = `${normalized}/README.md`;
  const absoluteReadmePath = path.resolve(rootDir, readmePath);
  if (!fs.existsSync(absoluteReadmePath) || !fs.statSync(absoluteReadmePath).isFile()) {
    return {
      readmePath,
      found: false,
      missingFields: [...TREE_EXCEPTION_REQUIRED_FIELDS],
      reason: null
    };
  }

  const coverage = inspectTreeExceptionText(fs.readFileSync(absoluteReadmePath, "utf8"));
  return {
    readmePath,
    found: coverage.found,
    missingFields: coverage.missingFields,
    reason: coverage.reason
  };
};

export const evaluateFlatDirectoryFinding = ({ directoryPath, currentShape, previousShape, exception }) => {
  const currentSignals = summarizeDirectoryTreeSignals(currentShape);
  if (!currentSignals.needsSubtree) {
    return null;
  }

  const previousSignals = summarizeDirectoryTreeSignals(previousShape);
  const completeException = exception.found && exception.missingFields.length === 0;
  const isStrictTouchedDirectory = isPathWithinPrefixes(directoryPath, STRICT_TOUCHED_FLAT_DIRECTORY_PATHS);
  if (completeException) {
    return {
      filePath: directoryPath,
      line: 1,
      column: 1,
      ownerLine: 1,
      level: "warn",
      message: `touched flat mixed directory still needs a subtree boundary, but an exception is recorded in ${exception.readmePath}`,
      reason: exception.reason
    };
  }
  if (isStrictTouchedDirectory) {
    return {
      filePath: directoryPath,
      line: 1,
      column: 1,
      ownerLine: 1,
      level: "error",
      message: "touched directory is under strict flat-directory governance; add a subtree boundary or record a complete exception before further edits",
      reason: null
    };
  }
  if (exception.found) {
    return {
      filePath: directoryPath,
      line: 1,
      column: 1,
      ownerLine: 1,
      level: "error",
      message: `touched flat mixed directory has an incomplete subtree exception note; missing=${exception.missingFields.join(", ")}`,
      reason: null
    };
  }
  if (!previousSignals.needsSubtree || currentSignals.directFileCount > previousSignals.directFileCount) {
    return {
      filePath: directoryPath,
      line: 1,
      column: 1,
      ownerLine: 1,
      level: "error",
      message: "touched directory is growing as a flat mixed-responsibility directory; split it into subtrees by responsibility",
      reason: null
    };
  }
  return {
    filePath: directoryPath,
    line: 1,
    column: 1,
    ownerLine: 1,
    level: "warn",
    message: "touched directory remains a flat mixed-responsibility directory without a subtree boundary",
    reason: null
  };
};

export const collectFlatDirectoryViolations = (changedFiles) => {
  const touchedDirectories = new Set(
    changedFiles
      .map((filePath) => normalizeDirectoryPath(path.posix.dirname(filePath)))
      .filter(Boolean)
      .filter(shouldCheckDirectory)
  );

  const violations = [];
  for (const directoryPath of touchedDirectories) {
    const finding = evaluateFlatDirectoryFinding({
      directoryPath,
      currentShape: listCurrentDirectoryShape(directoryPath),
      previousShape: listHeadDirectoryShape(directoryPath),
      exception: inspectTreeException(directoryPath)
    });
    if (!finding) {
      continue;
    }
    violations.push(finding);
  }
  return violations;
};

export const runFlatDirectoryCheck = (options) => {
  const { changedFiles } = collectChangedWorkspaceFiles(options);
  if (changedFiles.length === 0) {
    return { changedFiles, violations: [] };
  }

  return {
    changedFiles,
    violations: defaultSortByLocation(collectFlatDirectoryViolations(changedFiles), "ownerLine")
  };
};

export const printViolations = ({ changedFiles, violations }) => {
  if (changedFiles.length === 0) {
    console.log("No changed workspace source files to check.");
    return 0;
  }
  if (violations.length === 0) {
    console.log(`Flat-directory diff check passed for ${changedFiles.length} changed file(s).`);
    return 0;
  }

  const hasError = violations.some((item) => item.level === "error");
  console.error("Flat-directory diff check found mixed flat directories that should grow a subtree boundary.");
  for (const violation of violations) {
    console.error(`- [${violation.level}] ${violation.filePath}: ${violation.message}`);
    if (violation.reason) {
      console.error(`  exception reason: ${violation.reason}`);
    }
  }
  return hasError ? 1 : 0;
};

const main = () => {
  const options = parseDiffCheckArgs(process.argv.slice(2), usage);
  process.exit(printViolations(runFlatDirectoryCheck(options)));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

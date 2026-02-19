#!/usr/bin/env node
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const INCLUDE_DIRS = ["packages", "bridge", "scripts"];
const INCLUDE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sh", ".yml", ".yaml"]);
const EXCLUDE_DIRS = new Set([
  ".git",
  ".changeset",
  "node_modules",
  "dist",
  "coverage",
  "build",
  "ui-dist",
  ".turbo"
]);

const args = process.argv.slice(2);
const options = {
  outputPath: resolve(rootDir, "docs/metrics/code-volume/latest.json"),
  summaryPath: "",
  appendHistory: false,
  maxGrowthPercent: null
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--output") {
    options.outputPath = resolve(rootDir, args[index + 1] ?? "");
    index += 1;
    continue;
  }
  if (arg === "--summary-file") {
    options.summaryPath = resolve(rootDir, args[index + 1] ?? "");
    index += 1;
    continue;
  }
  if (arg === "--append-history") {
    options.appendHistory = true;
    continue;
  }
  if (arg === "--max-growth-percent") {
    const value = Number(args[index + 1]);
    options.maxGrowthPercent = Number.isFinite(value) ? value : null;
    index += 1;
  }
}

const toPosixPath = (input) => input.split("\\").join("/");

const detectLanguage = (extension) => {
  if (extension === ".ts") return "TypeScript";
  if (extension === ".tsx") return "TSX";
  if (extension === ".js") return "JavaScript";
  if (extension === ".jsx") return "JSX";
  if (extension === ".mjs") return "MJS";
  if (extension === ".cjs") return "CJS";
  if (extension === ".sh") return "Shell";
  if (extension === ".yml" || extension === ".yaml") return "YAML";
  return extension.slice(1).toUpperCase();
};

const detectScope = (relativePath) => {
  const segments = relativePath.split("/");
  if (segments[0] === "packages" && segments[1]) {
    return `packages/${segments[1]}`;
  }
  if (segments[0]) {
    return segments[0];
  }
  return "root";
};

const countLines = (content, extension) => {
  const lines = content.split(/\r?\n/);
  let blankLines = 0;
  let commentLines = 0;
  let codeLines = 0;

  const lineCommentPrefixes = extension === ".sh" || extension === ".yml" || extension === ".yaml" ? ["#"] : ["//"];
  const supportsBlockComment = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extension);
  let inBlockComment = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      blankLines += 1;
      continue;
    }

    if (supportsBlockComment && inBlockComment) {
      commentLines += 1;
      if (line.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }

    if (supportsBlockComment && line.startsWith("/*")) {
      commentLines += 1;
      if (!line.includes("*/")) {
        inBlockComment = true;
      }
      continue;
    }

    if (supportsBlockComment && line.startsWith("*")) {
      commentLines += 1;
      continue;
    }

    if (lineCommentPrefixes.some((prefix) => line.startsWith(prefix))) {
      commentLines += 1;
      continue;
    }

    codeLines += 1;
  }

  return {
    totalLines: lines.length,
    blankLines,
    commentLines,
    codeLines
  };
};

const listTrackedFiles = () => {
  const files = [];

  const walk = (directory) => {
    const entries = readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry.name)) {
          continue;
        }
        walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = extname(entry.name).toLowerCase();
      if (!INCLUDE_EXTENSIONS.has(extension)) {
        continue;
      }

      files.push(absolutePath);
    }
  };

  for (const includeDir of INCLUDE_DIRS) {
    const absoluteDir = resolve(rootDir, includeDir);
    if (!existsSync(absoluteDir) || !statSync(absoluteDir).isDirectory()) {
      continue;
    }
    walk(absoluteDir);
  }

  return files.sort();
};

const mergeMetrics = (target, increment) => {
  target.files += increment.files;
  target.totalLines += increment.totalLines;
  target.blankLines += increment.blankLines;
  target.commentLines += increment.commentLines;
  target.codeLines += increment.codeLines;
};

const toSortedArray = (map) =>
  [...map.entries()]
    .map(([name, metrics]) => ({ name, ...metrics }))
    .sort((left, right) => right.codeLines - left.codeLines || right.files - left.files || left.name.localeCompare(right.name));

const trackedFiles = listTrackedFiles();
const totals = { files: 0, totalLines: 0, blankLines: 0, commentLines: 0, codeLines: 0 };
const byLanguage = new Map();
const byScope = new Map();

for (const filePath of trackedFiles) {
  const extension = extname(filePath).toLowerCase();
  const language = detectLanguage(extension);
  const relativePath = toPosixPath(relative(rootDir, filePath));
  const scope = detectScope(relativePath);
  const content = readFileSync(filePath, "utf8");
  const lineMetrics = countLines(content, extension);
  const increment = {
    files: 1,
    totalLines: lineMetrics.totalLines,
    blankLines: lineMetrics.blankLines,
    commentLines: lineMetrics.commentLines,
    codeLines: lineMetrics.codeLines
  };

  mergeMetrics(totals, increment);

  if (!byLanguage.has(language)) {
    byLanguage.set(language, { files: 0, totalLines: 0, blankLines: 0, commentLines: 0, codeLines: 0 });
  }
  mergeMetrics(byLanguage.get(language), increment);

  if (!byScope.has(scope)) {
    byScope.set(scope, { files: 0, totalLines: 0, blankLines: 0, commentLines: 0, codeLines: 0 });
  }
  mergeMetrics(byScope.get(scope), increment);
}

let previousSnapshot = null;
if (existsSync(options.outputPath)) {
  try {
    previousSnapshot = JSON.parse(readFileSync(options.outputPath, "utf8"));
  } catch {
    previousSnapshot = null;
  }
}

const currentCodeLines = totals.codeLines;
const previousCodeLines = previousSnapshot?.totals?.codeLines;
const hasPrevious = typeof previousCodeLines === "number";
const deltaCodeLines = hasPrevious ? currentCodeLines - previousCodeLines : null;
const deltaPercent = hasPrevious && previousCodeLines !== 0 ? Number(((deltaCodeLines / previousCodeLines) * 100).toFixed(2)) : null;

const snapshot = {
  generatedAt: new Date().toISOString(),
  projectRoot: rootDir,
  git: {
    sha: process.env.GITHUB_SHA ?? "",
    ref: process.env.GITHUB_REF_NAME ?? ""
  },
  scope: {
    includeDirs: INCLUDE_DIRS,
    includeExtensions: [...INCLUDE_EXTENSIONS],
    excludeDirs: [...EXCLUDE_DIRS]
  },
  totals,
  delta: {
    previousCodeLines: hasPrevious ? previousCodeLines : null,
    codeLines: deltaCodeLines,
    percent: deltaPercent
  },
  byLanguage: toSortedArray(byLanguage),
  byScope: toSortedArray(byScope)
};

mkdirSync(dirname(options.outputPath), { recursive: true });
writeFileSync(options.outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

if (options.appendHistory) {
  const historyPath = resolve(dirname(options.outputPath), "history.jsonl");
  const historyEntry = {
    generatedAt: snapshot.generatedAt,
    codeLines: totals.codeLines,
    totalLines: totals.totalLines,
    files: totals.files,
    sha: snapshot.git.sha,
    ref: snapshot.git.ref
  };
  appendFileSync(historyPath, `${JSON.stringify(historyEntry)}\n`, "utf8");
}

const topScopes = snapshot.byScope.slice(0, 6);
const summaryLines = [
  "# Code Volume Snapshot",
  "",
  `- Generated at: ${snapshot.generatedAt}`,
  `- Tracked files: ${totals.files}`,
  `- Code lines (LOC): ${totals.codeLines}`,
  `- Total lines: ${totals.totalLines}`,
  hasPrevious
    ? `- Delta vs previous: ${deltaCodeLines >= 0 ? "+" : ""}${deltaCodeLines} LOC${
        deltaPercent === null ? "" : ` (${deltaPercent >= 0 ? "+" : ""}${deltaPercent}%)`
      }`
    : "- Delta vs previous: N/A (no baseline)",
  "",
  "## Top scopes by LOC",
  "",
  "| Scope | Files | LOC | Total lines |",
  "| --- | ---: | ---: | ---: |",
  ...topScopes.map((item) => `| ${item.name} | ${item.files} | ${item.codeLines} | ${item.totalLines} |`)
];
const summary = summaryLines.join("\n");

if (options.summaryPath) {
  mkdirSync(dirname(options.summaryPath), { recursive: true });
  writeFileSync(options.summaryPath, `${summary}\n`, "utf8");
}

console.log(`Code volume snapshot saved: ${toPosixPath(relative(rootDir, options.outputPath))}`);
console.log(`Tracked files: ${totals.files}`);
console.log(`Code lines (LOC): ${totals.codeLines}`);
if (hasPrevious) {
  console.log(`Delta vs previous: ${deltaCodeLines >= 0 ? "+" : ""}${deltaCodeLines} (${deltaPercent ?? "N/A"}%)`);
}

if (typeof options.maxGrowthPercent === "number" && hasPrevious && deltaPercent !== null && deltaPercent > options.maxGrowthPercent) {
  console.error(
    `LOC growth ${deltaPercent}% exceeds threshold ${options.maxGrowthPercent}%. Please review maintainability impact.`
  );
  process.exit(1);
}


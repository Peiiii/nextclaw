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

const PRIMARY_INCLUDE_DIRS = ["packages", "bridge", "scripts"];
const DEFAULT_BENCHMARK_INCLUDE_DIRS = ["src", "extensions", "scripts"];
const INCLUDE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sh", ".yml", ".yaml"];
const EXCLUDE_DIRS = [
  ".git",
  ".changeset",
  "node_modules",
  "dist",
  "coverage",
  "build",
  "ui-dist",
  ".turbo"
];

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const options = {
  outputPath: resolve(rootDir, "docs/metrics/code-volume/latest.json"),
  summaryPath: "",
  appendHistory: false,
  maxGrowthPercent: null,
  benchmarkName: "",
  benchmarkRoot: "",
  benchmarkIncludeDirs: "",
  benchmarkOutputPath: resolve(rootDir, "docs/metrics/code-volume/comparison.json")
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
    continue;
  }
  if (arg === "--benchmark-name") {
    options.benchmarkName = args[index + 1] ?? "";
    index += 1;
    continue;
  }
  if (arg === "--benchmark-root") {
    options.benchmarkRoot = args[index + 1] ?? "";
    index += 1;
    continue;
  }
  if (arg === "--benchmark-include-dirs") {
    options.benchmarkIncludeDirs = args[index + 1] ?? "";
    index += 1;
    continue;
  }
  if (arg === "--benchmark-output") {
    options.benchmarkOutputPath = resolve(rootDir, args[index + 1] ?? "");
    index += 1;
  }
}

const toPosixPath = (input) => input.split("\\").join("/");
const toPrecisionNumber = (value) => Number(value.toFixed(2));
const parseCsv = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

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
  if ((segments[0] === "packages" || segments[0] === "extensions") && segments[1]) {
    return `${segments[0]}/${segments[1]}`;
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

const listTrackedFiles = (repoRoot, includeDirs, includeExtensions, excludeDirs) => {
  const files = [];
  const includeExtensionSet = new Set(includeExtensions);
  const excludeDirSet = new Set(excludeDirs);

  const walk = (directory) => {
    const entries = readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (excludeDirSet.has(entry.name)) {
          continue;
        }
        walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = extname(entry.name).toLowerCase();
      if (!includeExtensionSet.has(extension)) {
        continue;
      }

      files.push(absolutePath);
    }
  };

  for (const includeDir of includeDirs) {
    const absoluteDir = resolve(repoRoot, includeDir);
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

const collectSnapshot = ({
  repoRoot,
  includeDirs,
  includeExtensions,
  excludeDirs,
  gitSha,
  gitRef,
  generatedAt
}) => {
  const trackedFiles = listTrackedFiles(repoRoot, includeDirs, includeExtensions, excludeDirs);
  const totals = { files: 0, totalLines: 0, blankLines: 0, commentLines: 0, codeLines: 0 };
  const byLanguage = new Map();
  const byScope = new Map();

  for (const filePath of trackedFiles) {
    const extension = extname(filePath).toLowerCase();
    const language = detectLanguage(extension);
    const relativePath = toPosixPath(relative(repoRoot, filePath));
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

  return {
    generatedAt,
    projectRoot: repoRoot,
    git: {
      sha: gitSha,
      ref: gitRef
    },
    scope: {
      includeDirs,
      includeExtensions,
      excludeDirs
    },
    totals,
    byLanguage: toSortedArray(byLanguage),
    byScope: toSortedArray(byScope)
  };
};

const generatedAt = new Date().toISOString();
const gitSha = process.env.GITHUB_SHA ?? "";
const gitRef = process.env.GITHUB_REF_NAME ?? "";

let previousSnapshot = null;
if (existsSync(options.outputPath)) {
  try {
    previousSnapshot = JSON.parse(readFileSync(options.outputPath, "utf8"));
  } catch {
    previousSnapshot = null;
  }
}

const snapshot = collectSnapshot({
  repoRoot: rootDir,
  includeDirs: PRIMARY_INCLUDE_DIRS,
  includeExtensions: INCLUDE_EXTENSIONS,
  excludeDirs: EXCLUDE_DIRS,
  gitSha,
  gitRef,
  generatedAt
});

const totals = snapshot.totals;
const currentCodeLines = totals.codeLines;
const previousCodeLines = previousSnapshot?.totals?.codeLines;
const hasPrevious = typeof previousCodeLines === "number";
const deltaCodeLines = hasPrevious ? currentCodeLines - previousCodeLines : null;
const deltaPercent = hasPrevious && previousCodeLines !== 0 ? Number(((deltaCodeLines / previousCodeLines) * 100).toFixed(2)) : null;

const snapshotWithDelta = {
  ...snapshot,
  delta: {
    previousCodeLines: hasPrevious ? previousCodeLines : null,
    codeLines: deltaCodeLines,
    percent: deltaPercent
  }
};

mkdirSync(dirname(options.outputPath), { recursive: true });
writeFileSync(options.outputPath, `${JSON.stringify(snapshotWithDelta, null, 2)}\n`, "utf8");

if (options.appendHistory) {
  const historyPath = resolve(dirname(options.outputPath), "history.jsonl");
  const historyEntry = {
    generatedAt: snapshotWithDelta.generatedAt,
    codeLines: totals.codeLines,
    totalLines: totals.totalLines,
    files: totals.files,
    sha: snapshotWithDelta.git.sha,
    ref: snapshotWithDelta.git.ref
  };
  appendFileSync(historyPath, `${JSON.stringify(historyEntry)}\n`, "utf8");
}

let benchmarkSummaryLines = [];
if (options.benchmarkRoot) {
  const benchmarkName = options.benchmarkName.trim() || "benchmark";
  const benchmarkRoot = resolve(rootDir, options.benchmarkRoot);
  if (!existsSync(benchmarkRoot) || !statSync(benchmarkRoot).isDirectory()) {
    console.error(`Benchmark repository not found: ${benchmarkRoot}`);
    process.exit(1);
  }

  const benchmarkIncludeDirs =
    options.benchmarkIncludeDirs.trim().length > 0 ? parseCsv(options.benchmarkIncludeDirs) : DEFAULT_BENCHMARK_INCLUDE_DIRS;

  const benchmarkSnapshot = collectSnapshot({
    repoRoot: benchmarkRoot,
    includeDirs: benchmarkIncludeDirs,
    includeExtensions: INCLUDE_EXTENSIONS,
    excludeDirs: EXCLUDE_DIRS,
    gitSha,
    gitRef,
    generatedAt
  });

  const baseCodeLines = totals.codeLines;
  const benchmarkCodeLines = benchmarkSnapshot.totals.codeLines;
  const benchmarkMultipleOfBase = baseCodeLines > 0 ? toPrecisionNumber(benchmarkCodeLines / baseCodeLines) : null;
  const basePercentOfBenchmark = benchmarkCodeLines > 0 ? toPrecisionNumber((baseCodeLines / benchmarkCodeLines) * 100) : null;
  const baseIsLighterByPercent =
    benchmarkCodeLines > 0 ? toPrecisionNumber((1 - baseCodeLines / benchmarkCodeLines) * 100) : null;
  const comparisonReport = {
    generatedAt,
    base: {
      name: "nextclaw",
      projectRoot: rootDir,
      scope: {
        includeDirs: PRIMARY_INCLUDE_DIRS,
        includeExtensions: INCLUDE_EXTENSIONS,
        excludeDirs: EXCLUDE_DIRS
      },
      totals
    },
    benchmark: {
      name: benchmarkName,
      projectRoot: benchmarkRoot,
      scope: {
        includeDirs: benchmarkIncludeDirs,
        includeExtensions: INCLUDE_EXTENSIONS,
        excludeDirs: EXCLUDE_DIRS
      },
      totals: benchmarkSnapshot.totals
    },
    comparison: {
      baseMinusBenchmarkLines: baseCodeLines - benchmarkCodeLines,
      basePercentOfBenchmark,
      benchmarkMultipleOfBase,
      baseIsLighterByPercent
    }
  };

  mkdirSync(dirname(options.benchmarkOutputPath), { recursive: true });
  writeFileSync(options.benchmarkOutputPath, `${JSON.stringify(comparisonReport, null, 2)}\n`, "utf8");

  benchmarkSummaryLines = [
    "",
    `## Benchmark vs ${benchmarkName}`,
    "",
    `- Base (nextclaw) LOC: ${baseCodeLines}`,
    `- Benchmark (${benchmarkName}) LOC: ${benchmarkCodeLines}`,
    `- NextClaw LOC / ${benchmarkName}: ${basePercentOfBenchmark === null ? "N/A" : `${basePercentOfBenchmark}%`}`,
    `- ${benchmarkName} / NextClaw: ${benchmarkMultipleOfBase === null ? "N/A" : `${benchmarkMultipleOfBase}x`}`,
    `- NextClaw lighter by: ${baseIsLighterByPercent === null ? "N/A" : `${baseIsLighterByPercent}%`}`
  ];

  console.log(
    `Benchmark snapshot saved: ${toPosixPath(relative(rootDir, options.benchmarkOutputPath))}`
  );
  if (basePercentOfBenchmark !== null && benchmarkMultipleOfBase !== null) {
    console.log(
      `Vs ${benchmarkName}: ${basePercentOfBenchmark}% size (${benchmarkName} is ${benchmarkMultipleOfBase}x of NextClaw)`
    );
  }
}

const topScopes = snapshotWithDelta.byScope.slice(0, 6);
const summaryLines = [
  "# Code Volume Snapshot",
  "",
  `- Generated at: ${snapshotWithDelta.generatedAt}`,
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
  ...topScopes.map((item) => `| ${item.name} | ${item.files} | ${item.codeLines} | ${item.totalLines} |`),
  ...benchmarkSummaryLines
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

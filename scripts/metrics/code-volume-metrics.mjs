#!/usr/bin/env node
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createBaseScanConfig,
  createBenchmarkScanConfig,
  DEFAULT_SCOPE_PROFILE,
  SUPPORTED_SCOPE_PROFILES
} from "./code-volume-metrics-profile.mjs";
import { collectSnapshot } from "./code-volume-metrics-snapshot.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const options = {
  scopeProfile: DEFAULT_SCOPE_PROFILE,
  outputPath: resolve(rootDir, "docs/metrics/code-volume/latest.json"),
  summaryPath: "",
  appendHistory: false,
  noWrite: false,
  printSummary: false,
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
  if (arg === "--scope-profile") {
    options.scopeProfile = args[index + 1] ?? DEFAULT_SCOPE_PROFILE;
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
  if (arg === "--no-write") {
    options.noWrite = true;
    continue;
  }
  if (arg === "--print-summary") {
    options.printSummary = true;
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
const toScopeSignature = (scope) =>
  JSON.stringify({
    profile: scope?.profile ?? null,
    includePaths: scope?.includePaths ?? [],
    includeExtensions: scope?.includeExtensions ?? [],
    excludeDirs: scope?.excludeDirs ?? []
  });

const generatedAt = new Date().toISOString();
const gitSha = process.env.GITHUB_SHA ?? "";
const gitRef = process.env.GITHUB_REF_NAME ?? "";
const scopeProfile = SUPPORTED_SCOPE_PROFILES.has(options.scopeProfile) ? options.scopeProfile : DEFAULT_SCOPE_PROFILE;
const baseScanConfig = createBaseScanConfig({ repoRoot: rootDir, scopeProfile });

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
  scopeProfile,
  includePaths: baseScanConfig.includePaths,
  includeExtensions: baseScanConfig.includeExtensions,
  excludeDirs: baseScanConfig.excludeDirs,
  gitSha,
  gitRef,
  generatedAt
});

const totals = snapshot.totals;
const currentCodeLines = totals.codeLines;
const previousCodeLines = previousSnapshot?.totals?.codeLines;
const currentScopeSignature = toScopeSignature(snapshot.scope);
const previousScopeSignature = toScopeSignature(previousSnapshot?.scope);
const hasPrevious = typeof previousCodeLines === "number" && currentScopeSignature === previousScopeSignature;
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

if (!options.noWrite) {
  mkdirSync(dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, `${JSON.stringify(snapshotWithDelta, null, 2)}\n`, "utf8");
}

if (options.appendHistory && !options.noWrite) {
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
    options.benchmarkIncludeDirs.trim().length > 0 ? parseCsv(options.benchmarkIncludeDirs) : [];
  const benchmarkScanConfig = createBenchmarkScanConfig({
    benchmarkIncludePaths: benchmarkIncludeDirs
  });

  const benchmarkSnapshot = collectSnapshot({
    repoRoot: benchmarkRoot,
    scopeProfile: "source",
    includePaths: benchmarkScanConfig.includePaths,
    includeExtensions: benchmarkScanConfig.includeExtensions,
    excludeDirs: benchmarkScanConfig.excludeDirs,
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
        profile: scopeProfile,
        title: baseScanConfig.title,
        includePaths: baseScanConfig.includePaths,
        includeExtensions: baseScanConfig.includeExtensions,
        excludeDirs: baseScanConfig.excludeDirs
      },
      totals
    },
    benchmark: {
      name: benchmarkName,
      projectRoot: benchmarkRoot,
      scope: {
        profile: "source",
        includePaths: benchmarkScanConfig.includePaths,
        includeExtensions: benchmarkScanConfig.includeExtensions,
        excludeDirs: benchmarkScanConfig.excludeDirs
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

  if (!options.noWrite) {
    mkdirSync(dirname(options.benchmarkOutputPath), { recursive: true });
    writeFileSync(options.benchmarkOutputPath, `${JSON.stringify(comparisonReport, null, 2)}\n`, "utf8");
  }

  benchmarkSummaryLines = [
    "",
    `## Benchmark vs ${benchmarkName}`,
    "",
    `- Base (${baseScanConfig.title}) LOC: ${baseCodeLines}`,
    `- Benchmark (${benchmarkName}) LOC: ${benchmarkCodeLines}`,
    `- NextClaw ${baseScanConfig.title} / ${benchmarkName}: ${basePercentOfBenchmark === null ? "N/A" : `${basePercentOfBenchmark}%`}`,
    `- ${benchmarkName} / NextClaw: ${benchmarkMultipleOfBase === null ? "N/A" : `${benchmarkMultipleOfBase}x`}`,
    `- NextClaw lighter by: ${baseIsLighterByPercent === null ? "N/A" : `${baseIsLighterByPercent}%`}`
  ];

  if (!options.noWrite) {
    console.log(
      `Benchmark snapshot saved: ${toPosixPath(relative(rootDir, options.benchmarkOutputPath))}`
    );
  }
  if (basePercentOfBenchmark !== null && benchmarkMultipleOfBase !== null) {
    console.log(
      `Vs ${benchmarkName}: ${basePercentOfBenchmark}% size (${benchmarkName} is ${benchmarkMultipleOfBase}x of NextClaw)`
    );
  }
}

const topScopes = snapshotWithDelta.byScope.slice(0, 6);
const summaryLines = [
  `# ${baseScanConfig.title} Snapshot`,
  "",
  `- Profile: ${scopeProfile}`,
  `- Generated at: ${snapshotWithDelta.generatedAt}`,
  `- Tracked files: ${totals.files}`,
  `- Code lines (LOC): ${totals.codeLines}`,
  `- Total lines: ${totals.totalLines}`,
  hasPrevious
    ? `- Delta vs previous: ${deltaCodeLines >= 0 ? "+" : ""}${deltaCodeLines} LOC${
        deltaPercent === null ? "" : ` (${deltaPercent >= 0 ? "+" : ""}${deltaPercent}%)`
      }`
    : "- Delta vs previous: N/A (no comparable baseline)",
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

if (options.printSummary) {
  console.log(`\n${summary}`);
}

if (!options.noWrite) {
  console.log(`${baseScanConfig.title} snapshot saved: ${toPosixPath(relative(rootDir, options.outputPath))}`);
}
console.log(`Profile: ${scopeProfile}`);
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

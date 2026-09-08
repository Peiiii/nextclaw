import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { execFileSync, spawnSync } from "node:child_process";
import { loadConfig, resolveConfigSecrets } from "@nextclaw/core";
import { TASK_FIXTURES } from "#benchmark/tasks/fixtures.config.mjs";
import { PRICE_SNAPSHOT, hash } from "#benchmark/measurement/usage.utils.mjs";
import { MATRIX_SCHEMA, aggregateCases, benchmarkSettings, compareMatrixReports, evaluateCostParity, renderReport } from "#benchmark/reporting/report.utils.mjs";

const sourceDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repository = resolve(sourceDir, "../../..");

function inspectRuntime(sdkDir) {
  const require = createRequire(join(resolve(sdkDir), "package.json"));
  const sdkEntry = require.resolve("@deepseek-ai/dsh-sdk-client");
  const sdkVersion = JSON.parse(readFileSync(resolve(dirname(sdkEntry), "../package.json"), "utf8")).version;
  execFileSync("python3", ["--version"], { stdio: "pipe" });
  return { sdkEntry: pathToFileURL(sdkEntry).href, sdkVersion };
}

function readKey(home) {
  const configPath = join(home, "config.json");
  const config = resolveConfigSecrets(loadConfig(configPath), { configPath });
  const { apiKey, apiBase } = config.providers.deepseek;
  if (!apiKey || (apiBase && !/^https:\/\/api\.deepseek\.com(?:\/v1)?\/?$/.test(apiBase))) {
    throw new Error("Configure an official DeepSeek route before benchmarking");
  }
  return apiKey;
}

function sourceIdentity() {
  const files = [
    "packages/ncp-packages/nextclaw-ncp-agent-runtime/src/runtime/utils/message-converter.utils.ts",
    "packages/ncp-packages/nextclaw-ncp-agent-runtime-next/src/runtime/agent-runtime.service.ts",
    "packages/nextclaw-kernel/src/features/harness/managers/nextclaw-kernel-capability.manager.ts",
    "packages/nextclaw-kernel/src/contributions/context-provider/index.ts",
    "packages/nextclaw-kernel/src/contributions/context-provider/providers/native-static-context.provider.ts",
    "packages/nextclaw-kernel/src/contributions/context-provider/providers/reply-format-context.provider.ts",
    "packages/nextclaw-kernel/src/contributions/context-provider/providers/skills-context.provider.ts",
    "packages/nextclaw-kernel/src/contributions/tool-provider/providers/session-tool.provider.ts",
    "packages/nextclaw-kernel/src/managers/tool-provider.manager.ts",
    "packages/nextclaw-kernel/src/tools/tool-schema.tools.ts",
    "packages/nextclaw-kernel/src/utils/agent-model-input-budget.utils.ts",
    "packages/nextclaw-core/src/features/session-search/services/session-search.service.ts",
    "packages/nextclaw-core/src/features/runtime-context/services/context-compaction.service.ts",
    "packages/nextclaw-kernel/src/features/context-compaction/services/context-compaction-preflight.service.ts",
    "packages/nextclaw-kernel/src/features/context-compaction/utils/context-compaction.utils.ts",
    "packages/nextclaw-core/src/features/agent/shared/skills/visualize-output/SKILL.md",
    "packages/nextclaw-core/src/features/agent/shared/skills/visualize-output/references/inline-display.md",
  ];
  return { revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim(),
    dirty: Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: repository, encoding: "utf8" }).trim()),
    fingerprint: hash(files.map((path) => [path, readFileSync(join(repository, path), "utf8")])) };
}

function executeCase({ harness, taskId, outputDir, ledgerPath, runtime, key, timeoutMs }) {
  const caseDir = join(outputDir, "cases", `${harness}-${taskId}`); mkdirSync(caseDir, { recursive: true });
  const home = mkdtempSync(join(tmpdir(), "nextclaw-agent-benchmark-"));
  const workspace = join(home, "workspace"); mkdirSync(workspace);
  const configPath = join(caseDir, "worker.json"), reportPath = join(caseDir, "case.json");
  writeFileSync(configPath, JSON.stringify({ harness, taskId, home, workspace, reportPath,
    tracePath: join(caseDir, "requests.jsonl"), ledgerPath, model: "deepseek/deepseek-v4-flash",
    maxOutputTokens: TASK_FIXTURES[taskId].maxOutputTokens, timeoutMs, sdkEntry: runtime.sdkEntry, allowNonStreaming: true,
    observerPath: join(sourceDir, "measurement/request-observer.manager.mjs") }), { mode: 0o600 });
  const started = Date.now();
  const child = spawnSync(process.execPath, [...process.execArgv, join(sourceDir, "adapters/worker.controller.mjs")], {
    cwd: workspace, encoding: "utf8", timeout: timeoutMs + 15000, maxBuffer: 1_000_000,
    env: { PATH: process.env.PATH, HOME: home, USERPROFILE: home,
      XDG_CONFIG_HOME: join(home, ".config"), XDG_DATA_HOME: join(home, ".local/share"),
      XDG_CACHE_HOME: join(home, ".cache"), TMPDIR: process.env.TMPDIR,
      TSX_TSCONFIG_PATH: join(repository, "scripts/dev/dev-runtime.tsconfig.json"),
      CACHE_BENCHMARK_API_KEY: key, NEXTCLAW_BENCHMARK_WORKER_CONFIG: configPath },
  });
  writeFileSync(join(caseDir, "worker.log"), (child.stdout ?? "") + (child.stderr ?? ""));
  if (!child.error && child.status !== null) rmSync(home, { recursive: true, force: true });
  if (child.error || child.status !== 0) throw new Error(`${harness}/${taskId} worker failed; inspect ${caseDir}`);
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  return { ...report, workerExecutionMs: report.durationMs, durationMs: Date.now() - started,
    fixtureVersion: TASK_FIXTURES[taskId].version, maxOutputTokens: TASK_FIXTURES[taskId].maxOutputTokens };
}

function finishReport({ options, outputDir, ledgerPath, runtime, startedAt, cases, failure, baseline }) {
  const settings = benchmarkSettings(options.tasks), totals = aggregateCases(cases, options.tasks);
  const report = { schema: MATRIX_SCHEMA, runId: basenameForRun(outputDir), startedAt, endedAt: new Date().toISOString(),
    settings, source: sourceIdentity(), harnessVersions: { dsh: runtime.sdkVersion, nextclaw: "workspace" },
    budget: JSON.parse(readFileSync(ledgerPath, "utf8")), priceSnapshot: PRICE_SNAPSHOT,
    costKind: "provider-usage-times-price-estimate-not-invoice", totals, cases, failure,
    ok: !failure && Object.values(totals).every((entry) => entry.valid) };
  report.costParity = evaluateCostParity(totals);
  report.executionPassed = report.ok;
  report.ok &&= report.costParity.passed;
  if (baseline) {
    report.comparison = compareMatrixReports(baseline, report);
    report.regression = Object.values(report.comparison).some((entry) => !entry.comparable || entry.cacheRateDelta < -0.05);
    report.ok &&= !report.regression;
  }
  writeFileSync(join(outputDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(join(outputDir, "report.md"), renderReport(report));
  return { ...report, outputDir };
}

const basenameForRun = (path) => path.split(/[\\/]/).at(-1);

export function runBenchmark(options) {
  const { sdkDir, home, tasks, output, baseline: baselinePath, budgetUsd, maxCalls, timeoutMs, dryRun } = options;
  const runtime = inspectRuntime(sdkDir), settings = benchmarkSettings(tasks);
  const baseline = baselinePath ? JSON.parse(readFileSync(baselinePath, "utf8")) : null;
  if (baseline && (baseline.schema !== MATRIX_SCHEMA || hash(baseline.settings) !== hash(settings))) {
    throw new Error("Baseline settings differ; no paid requests dispatched");
  }
  const jobs = tasks.flatMap((taskId) => ["nextclaw", "dsh"].map((harness) => ({ taskId, harness })));
  if (dryRun) return { dryRun: true, jobs, settings, runtime, budgetUsd, maxCalls, paidRequests: 0, ok: true };
  const key = readKey(home), startedAt = new Date().toISOString();
  const outputDir = output || join(home, "benchmarks/results", startedAt.replaceAll(":", "-"));
  mkdirSync(outputDir, { recursive: true });
  const ledgerPath = join(outputDir, "budget.json");
  writeFileSync(ledgerPath, JSON.stringify({ used: 0, calls: 0, limit: budgetUsd, maxCalls }) + "\n", { flag: "wx" });
  const cases = []; let failure = null;
  for (const job of jobs) {
    try {
      const result = executeCase({ ...job, outputDir, ledgerPath, runtime, key, timeoutMs }); cases.push(result);
      console.error(`[benchmark] ${job.harness}/${job.taskId}: ${result.passed ? "PASS" : "FAIL"}; USD=${result.all.estimatedCostUsd}`);
      if (!result.passed) { failure = `${job.harness}/${job.taskId} failed acceptance`; break; }
    } catch (error) { failure = String(error); break; }
  }
  return finishReport({ options, outputDir, ledgerPath, runtime, startedAt, cases, failure, baseline });
}

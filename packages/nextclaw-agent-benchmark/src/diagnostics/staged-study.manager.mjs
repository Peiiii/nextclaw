// Cumulative source ablation. Reuses the standard isolated worker and budget observer.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, realpathSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig, resolveConfigSecrets } from "@nextclaw/core";
import { aggregateCases, benchmarkSettings, renderStagedReport } from "#benchmark/reporting/report.utils.mjs";
import { hash } from "#benchmark/measurement/usage.utils.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const taskIds = ["files", "config", "repair"];
const binding = "packages/nextclaw-kernel/src/features/harness/managers/nextclaw-kernel-capability.manager.ts";
const stageNames = ["original", "model-rounds", "resident-prompts", "stable-tools", "compaction", "deferred-parameters"];

function stageFor(path) {
  if (path.includes("ncp-packages/")) return 1;
  if (path.includes("context-provider/") || path.includes("visualize-output/")) return 2;
  if (path.includes("session-search") || path.endsWith("session-tool.provider.ts")) return 3;
  if (path.includes("compaction")) return 4;
  if (path.endsWith("tool-provider.manager.ts") || path.endsWith("agent-model-input-budget.utils.ts")) return 5;
  throw new Error(`Unclassified source change: ${path}`);
}

function freezeSources(output) {
  const changed = execFileSync("git", ["diff", "--name-only", "HEAD", "--", "packages"], { cwd: repository, encoding: "utf8" })
    .trim().split("\n").filter((p) => p && !p.endsWith(".test.ts") && p !== binding);
  const sources = changed.map((path) => ({ path, stage: stageFor(path),
    original: execFileSync("git", ["show", `HEAD:${path}`], { cwd: repository, encoding: "utf8" }),
    optimized: readFileSync(join(repository, path), "utf8") }));
  const snapshot = join(mkdtempSync(join(tmpdir(), "nextclaw-staged-study-")), "repository");
  execFileSync("cp", ["-cR", repository, snapshot]);
  const resolved = JSON.parse(execFileSync(process.execPath, ["--conditions=development", "--input-type=module", "-e",
    `import {createRequire} from 'node:module';const r=createRequire(${JSON.stringify(join(snapshot, "packages/nextclaw-agent-benchmark/package.json"))});console.log(JSON.stringify(r.resolve('@nextclaw/kernel')))`,
  ], { encoding: "utf8" }));
  if (!realpathSync(resolved).startsWith(realpathSync(snapshot) + "/")) throw new Error("Snapshot source isolation failed");
  const manifest = { schema: "cumulative-study-v1", baseRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim(),
    snapshot, stageNames, sources, bindingException: binding, bindingHash: hash(readFileSync(join(snapshot, binding), "utf8")),
    settings: { ...benchmarkSettings(taskIds), outputCaps: Object.fromEntries(taskIds.map((id) => [id, 2048])) },
    budgetUsd: 0.25, maxCalls: 180, seed: "rotating-task-order-v1", repeats: 1,
    limitation: "Provider caches are not reset. Short tasks need not activate compaction. No selective retries." };
  writeFileSync(join(output, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

function selectStage(manifest, stage) {
  for (const source of manifest.sources) writeFileSync(join(manifest.snapshot, source.path), source.stage <= stage ? source.optimized : source.original);
  return hash(manifest.sources.map(({ path }) => [path, readFileSync(join(manifest.snapshot, path), "utf8")]));
}

function executeCase(manifest, output, variant, taskId, sdkEntry, key) {
  const isDsh = variant === "dsh", stage = isDsh ? 5 : Number(variant.slice(1));
  const fingerprint = selectStage(manifest, stage);
  const dir = join(output, `${variant}-${taskId}`); mkdirSync(dir);
  const home = mkdtempSync(join(tmpdir(), "nextclaw-stage-case-")), workspace = join(home, "workspace"); mkdirSync(workspace);
  const configPath = join(dir, "worker.json"), source = join(manifest.snapshot, "packages/nextclaw-agent-benchmark/src");
  writeFileSync(configPath, JSON.stringify({ harness: isDsh ? "dsh" : "nextclaw", taskId, home, workspace,
    model: "deepseek/deepseek-v4-flash", maxOutputTokens: 2048, timeoutMs: 120000, allowNonStreaming: true,
    tracePath: join(dir, "requests.jsonl"), reportPath: join(dir, "case.json"), ledgerPath: join(output, "budget.json"),
    sdkEntry, observerPath: join(source, "measurement/request-observer.manager.mjs") }), { mode: 0o600 });
  const started = Date.now();
  const child = spawnSync(process.execPath, [...process.execArgv, join(source, "adapters/worker.controller.mjs")], {
    cwd: workspace, timeout: 135000, encoding: "utf8", maxBuffer: 1000000,
    env: { PATH: process.env.PATH, HOME: home, USERPROFILE: home, NEXTCLAW_HOME: home,
      XDG_CONFIG_HOME: join(home, ".config"), XDG_DATA_HOME: join(home, ".local/share"), XDG_CACHE_HOME: join(home, ".cache"),
      TMPDIR: process.env.TMPDIR, TSX_TSCONFIG_PATH: join(manifest.snapshot, "scripts/dev/dev-runtime.tsconfig.json"),
      CACHE_BENCHMARK_API_KEY: key, NEXTCLAW_BENCHMARK_WORKER_CONFIG: configPath } });
  writeFileSync(join(dir, "worker.log"), (child.stdout ?? "") + (child.stderr ?? ""));
  if (child.error || child.status !== 0) throw new Error(`Worker failed: ${variant}/${taskId}; inspect ${dir}`);
  return { ...JSON.parse(readFileSync(join(dir, "case.json"), "utf8")), variant, fingerprint, durationMs: Date.now() - started };
}

function saveReport(output, manifest, cases) {
  const totals = Object.fromEntries([...stageNames.map((_, i) => `s${i}`), "dsh"].map((variant) => {
    const own = cases.filter((c) => c.variant === variant);
    const total = aggregateCases(own, taskIds)[variant === "dsh" ? "dsh" : "nextclaw"];
    return [variant, total];
  }));
  const changes = Object.fromEntries(stageNames.slice(1).map((_, index) => {
    const id = `s${index + 1}`, current = totals[id];
    const compare = (baseline) => !current || !baseline ? null : Object.fromEntries([
      "estimatedCostUsd", "inputTokens", "outputTokens", "totalTokens", "durationMs", "modelRequestMs", "calls", "cacheRate",
    ].map((metric) => [metric, { before: baseline[metric], after: current[metric],
      delta: current[metric] - baseline[metric], relative: baseline[metric] ? current[metric] / baseline[metric] - 1 : null }]));
    return [id, { previous: compare(totals[`s${index}`]), original: compare(totals.s0) }];
  }));
  const report = { settings: manifest.settings, stageNames, totals, changes, cases, budget: JSON.parse(readFileSync(join(output, "budget.json"), "utf8")) };
  writeFileSync(join(output, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(output, "report.md"), renderStagedReport(report));
  return report;
}

export function runStagedStudy(outputPath, sdkDir, dryRun = false) {
  const output = resolve(outputPath);
  mkdirSync(output, { recursive: true });
  const manifestPath = join(output, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : freezeSources(output);
  const variants = [...stageNames.map((_, i) => `s${i}`), "dsh"];
  const jobs = taskIds.flatMap((taskId, i) => [...variants.slice(i * 2), ...variants.slice(0, i * 2)].map((variant) => ({ variant, taskId })));
  if (dryRun) { console.log(JSON.stringify({ jobs, settings: manifest.settings, budgetUsd: manifest.budgetUsd, paidRequests: 0 })); return; }
  const require = createRequire(join(resolve(sdkDir), "package.json"));
  const sdkEntry = pathToFileURL(require.resolve("@deepseek-ai/dsh-sdk-client")).href;
  const configPath = join(process.env.HOME, ".nextclaw/config.json");
  const key = resolveConfigSecrets(loadConfig(configPath), { configPath }).providers.deepseek.apiKey;
  if (!key) throw new Error("DeepSeek key missing");
  const ledger = join(output, "budget.json");
  if (!existsSync(ledger)) writeFileSync(ledger, JSON.stringify({ used: 0, calls: 0, limit: manifest.budgetUsd, maxCalls: manifest.maxCalls }), { flag: "wx", mode: 0o600 });
  const reportPath = join(output, "report.json");
  const cases = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")).cases : [];
  for (const { variant, taskId } of jobs) {
    if (cases.some((c) => c.variant === variant && c.taskId === taskId)) continue;
    const result = executeCase(manifest, output, variant, taskId, sdkEntry, key);
    cases.push(result); saveReport(output, manifest, cases);
    console.log(JSON.stringify({ variant, taskId, passed: result.passed, cost: result.all.estimatedCostUsd, calls: result.all.calls }));
  }
  console.log(JSON.stringify(saveReport(output, manifest, cases).totals));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [output, sdkDir, option] = process.argv.slice(2);
  if (!output || !sdkDir) throw new Error("Usage: staged-study.manager.mjs <output> <dsh-sdk-dir> [--dry-run]");
  runStagedStudy(output, sdkDir, option === "--dry-run");
}

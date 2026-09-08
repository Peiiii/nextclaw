#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { DEFAULT_TASKS, compareMatrixReports, renderReport } from "#benchmark/reporting/report.utils.mjs";
import { TASK_FIXTURES } from "#benchmark/tasks/fixtures.config.mjs";

function readOptions(argv) {
  const { values, positionals } = parseArgs({ args: argv, strict: true, allowPositionals: true, options: {
    "budget-usd": { type: "string", default: "0.05" }, "max-calls": { type: "string", default: "48" },
    "timeout-ms": { type: "string", default: "120000" }, tasks: { type: "string", default: DEFAULT_TASKS.join(",") },
    home: { type: "string", default: process.env.NEXTCLAW_HOME || join(homedir(), ".nextclaw") },
    "dsh-sdk-dir": { type: "string" }, output: { type: "string" }, baseline: { type: "string" },
    "dry-run": { type: "boolean", default: false }, json: { type: "boolean", default: false }, help: { type: "boolean", default: false },
  } });
  const tasks = values.tasks.split(",");
  const budgetUsd = Number(values["budget-usd"]), maxCalls = Number(values["max-calls"]), timeoutMs = Number(values["timeout-ms"]);
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 1 || !Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 100
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new Error("Invalid budget, call limit or timeout");
  if (new Set(tasks).size !== tasks.length || tasks.some((id) => !TASK_FIXTURES[id])) throw new Error("Select unique known tasks");
  const home = resolve(values.home);
  return { command: positionals[0] ?? "run", paths: positionals.slice(1), help: values.help, json: values.json,
    tasks, home, budgetUsd, maxCalls, timeoutMs, dryRun: values["dry-run"],
    sdkDir: resolve(values["dsh-sdk-dir"] ?? join(home, "benchmarks/deepseek-harness")),
    output: values.output ? resolve(values.output) : null, baseline: values.baseline ? resolve(values.baseline) : null };
}

function printResult(result) {
  if (result.dryRun) { console.log(JSON.stringify(result, null, 2)); return; }
  for (const [harness, total] of Object.entries(result.totals)) {
    const rate = total.valid ? `${(total.goldenCacheHitRate * 100).toFixed(2)}%` : "不可判定";
    console.log(`${harness} 核心缓存命中率：${rate}；完成 ${total.completedTasks}/${total.expectedTasks}；`
      + `USD ${total.estimatedCostUsd?.toFixed(6) ?? "未知"}；${total.totalTokens} token；${(total.durationMs / 1000).toFixed(1)} 秒`);
  }
  if (result.costParity) console.log(`成本验收（NextClaw 最多高 5%）：${result.costParity.passed ? "PASS" : "FAIL"}`);
  console.log(`状态：${result.ok ? "PASS" : "FAIL"}\n报告：${join(result.outputDir, "report.md")}`);
}

async function main() {
  const options = readOptions(process.argv.slice(2).filter((arg) => arg !== "--"));
  const { command, paths, help, json } = options;
  if (help) {
    console.log("pnpm benchmark:cache [run|list|show <report.json>|compare <old.json> <new.json>]\n"
      + "run: --budget-usd 0.05 --dsh-sdk-dir <optional SDK install directory> --output <new directory>\n"
      + "     --baseline <compatible report.json> --tasks files,config,repair --dry-run --json\n"
      + "Default: three real tasks × two harnesses; shared budget; no scheduled runs.");
    return;
  }
  if (command === "list") { console.log(JSON.stringify(TASK_FIXTURES, null, 2)); return; }
  if (command === "show" && paths.length === 1) { console.log(renderReport(JSON.parse(readFileSync(paths[0], "utf8")))); return; }
  if (command === "compare" && paths.length === 2) {
    console.log(JSON.stringify(compareMatrixReports(...paths.map((path) => JSON.parse(readFileSync(path, "utf8")))), null, 2)); return;
  }
  if (command !== "run" || paths.length) throw new Error("Invalid benchmark command; use --help");
  const { runBenchmark } = await import("./runner.manager.mjs");
  const result = runBenchmark(options);
  if (json) console.log(JSON.stringify(result, null, 2)); else printResult(result);
  process.exitCode = result.ok ? 0 : 1;
}

await main().catch((error) => { console.error(error.message); process.exitCode = 1; });

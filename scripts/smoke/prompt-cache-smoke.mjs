#!/usr/bin/env node

import { fail, parseArgs, printPretty } from "./prompt-cache/prompt-cache-smoke.shared.mjs";
import { readFileSync } from "node:fs";
import { compareReports } from "./prompt-cache/prompt-cache-smoke.metrics.mjs";

async function createRunner(options) {
  if (options.transport === "task-suite") {
    const { createDiagnosticRunner } = await import("@nextclaw/agent-benchmark");
    return await createDiagnosticRunner(options);
  }
  if (options.transport === "ncp-chat") {
    const { NcpChatPromptCacheSmokeRunner } = await import("./prompt-cache/prompt-cache-smoke.ncp-chat.mjs");
    return new NcpChatPromptCacheSmokeRunner(options);
  }
  const { ProviderDirectPromptCacheSmokeRunner } = await import("./prompt-cache/prompt-cache-smoke.provider-direct.mjs");
  return new ProviderDirectPromptCacheSmokeRunner(options);
}

async function main() {
  const argv = process.argv.slice(2).filter((arg) => arg !== "--");
  if (argv[0] === "--compare") {
    if (argv.length !== 3) throw new Error("--compare requires two existing report paths; no API calls are made");
    console.log(JSON.stringify(compareReports(...argv.slice(1).map((path) => JSON.parse(readFileSync(path, "utf8")))), null, 2));
    return;
  }
  const options = parseArgs(argv);
  try {
    const runner = await createRunner(options);
    const result = await runner.run();
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
      return;
    }
    if (options.transport === "task-suite") {
      const rate = result.golden.taskCompleted && result.golden.cacheHitRate !== null
        ? `${(result.golden.cacheHitRate * 100).toFixed(1)}%` : "不可判定（任务未完成或用量不完整）";
      console.log(`固定真实任务整体缓存命中率：${rate}\n状态：${result.status}\n详细报告：${result.reportPath}`);
      process.exit(result.ok ? 0 : 1);
      return;
    }
    printPretty(result);
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error), options.json);
  }
}

await main();

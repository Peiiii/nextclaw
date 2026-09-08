import { homedir } from "node:os";
import { resolve } from "node:path";

export const DEFAULT_TRANSPORT = "provider-direct";
export const DEFAULT_PORT = 18792;
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_SESSION_TYPE = "native";
export const DEFAULT_USAGE_SOURCE = "ui-ncp";
export const DEFAULT_RUNS = 4;
export const DEFAULT_USAGE_SETTLE_MS = 1_500;
export const DEFAULT_TIMEOUT_MS = 180_000;
export const DEFAULT_MIN_CACHE_RATE = 0.5;
export const DEFAULT_PROMPT_TARGET_CHARS = 30_000;
export { DEFAULT_EXPECTED_REPLY, buildStablePrompt } from "@nextclaw/agent-benchmark";
export const SESSION_TYPE_READY_POLL_MS = 500;

export function printHelp() {
  console.log(`Usage: pnpm smoke:prompt-cache -- --model <id> [options]

Options:
  --model <id>               Real model to test, e.g. minimax/MiniMax-M2.7
  --transport <mode>         provider-direct, ncp-chat, or task-suite (default: ${DEFAULT_TRANSPORT})
  --budget-usd <amount>      Task suite maximum estimated spend, checked before dispatch (default: 0.10)
  --max-calls <n>            Task suite request limit including retries (default: 18)
  --max-output-tokens <n>    Task suite per-call output cap (default: 512)
  --prices <miss,hit,out>    Override USD per million tokens; otherwise dated DeepSeek price snapshot
  --output <file>            Save task suite JSON report (parent directory must exist)
  --baseline <file>          Compare this run to a compatible saved report
  --compare <old> <new>      Compare two saved suite reports offline; no --model or paid calls
  --runs <n>                 Total repeated runs (default: ${DEFAULT_RUNS})
  --prompt <text>            Exact stable system prompt to reuse across all runs
  --prompt-target-chars <n>  Generated prompt target size when --prompt is omitted (default: ${DEFAULT_PROMPT_TARGET_CHARS})
  --min-cache-rate <ratio>   Minimum later-run cached/prompt token rate required for PASS (default: ${DEFAULT_MIN_CACHE_RATE})
  --home <dir>               NEXTCLAW_HOME containing config.json (default: $NEXTCLAW_HOME or ~/.nextclaw)
  --base-url <url>           NCP API base URL when --transport ncp-chat (default: http://${DEFAULT_HOST}:${DEFAULT_PORT})
  --port <port>              NCP API port when --base-url is omitted (default: ${DEFAULT_PORT})
  --session-type <type>      NCP session type when --transport ncp-chat (default: ${DEFAULT_SESSION_TYPE})
  --usage-source <source>    Usage record source when --transport ncp-chat (default: ${DEFAULT_USAGE_SOURCE})
  --usage-settle-ms <ms>     Wait after each NCP run for usage log flush (default: ${DEFAULT_USAGE_SETTLE_MS})
  --timeout-ms <ms>          Per-run timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --json                     Print machine-readable JSON
  --help                     Show this help
`);
}

export function fail(message, json = false) {
  if (json) {
    console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  } else {
    console.error(`[prompt-cache-smoke] ${message}`);
  }
  process.exit(1);
}

function normalizeBaseUrl(options) {
  if (options.baseUrl.trim()) {
    options.baseUrl = options.baseUrl.replace(/\/+$/, "");
    return;
  }
  const port = Number.parseInt(options.port, 10);
  if (!Number.isFinite(port) || port <= 0) {
    fail("--port must be a positive integer", options.json);
  }
  options.baseUrl = `http://${DEFAULT_HOST}:${port}`;
}

function assertOptionRanges({
  model, json, transport, budgetUsd, maxCalls, maxOutputTokens, prices, runs, promptTargetChars,
  minCacheRate, timeoutMs, usageSettleMs, home, sessionType, usageSource
}) {
  if (!model.trim()) {
    fail("--model is required", json);
  }
  if (!["provider-direct", "ncp-chat", "task-suite"].includes(transport.trim())) {
    fail("--transport must be provider-direct, ncp-chat or task-suite", json);
  }
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 5
    || !Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 100
    || !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 32 || maxOutputTokens > 4096) {
    fail("Invalid suite budget, call count or output cap", json);
  }
  if (prices && Object.values(prices).some((price) => !Number.isFinite(price) || price < 0)) {
    fail("--prices requires three nonnegative USD prices: miss,hit,out", json);
  }
  if (!Number.isFinite(runs) || runs < 2) {
    fail("--runs must be an integer >= 2", json);
  }
  if (!Number.isFinite(promptTargetChars) || promptTargetChars < 2_000) {
    fail("--prompt-target-chars must be an integer >= 2000", json);
  }
  if (!Number.isFinite(minCacheRate) || minCacheRate < 0 || minCacheRate > 1) {
    fail("--min-cache-rate must be between 0 and 1", json);
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000) {
    fail("--timeout-ms must be an integer >= 1000", json);
  }
  if (!Number.isFinite(usageSettleMs) || usageSettleMs < 0) {
    fail("--usage-settle-ms must be an integer >= 0", json);
  }
  if (!home.trim()) {
    fail("--home cannot be empty", json);
  }
  if (!sessionType.trim()) {
    fail("--session-type cannot be empty", json);
  }
  if (!usageSource.trim()) {
    fail("--usage-source cannot be empty", json);
  }
}

function applyArgument(currentOptions, arg, next) {
  const options = { ...currentOptions };
  switch (arg) {
    case "--budget-usd": options.budgetUsd = Number(next); return { options, consumed: 1 };
    case "--max-calls": options.maxCalls = Number(next); return { options, consumed: 1 };
    case "--max-output-tokens": options.maxOutputTokens = Number(next); return { options, consumed: 1 };
    case "--output": options.output = next ?? ""; return { options, consumed: 1 };
    case "--baseline": options.baseline = next ?? ""; return { options, consumed: 1 };
    case "--prices": {
      const values = (next ?? "").split(",").map(Number);
      options.prices = { input: values.length === 3 ? values[0] : NaN, cached: values[1], output: values[2] };
      return { options, consumed: 1 };
    }
    case "--model":
      options.model = next ?? "";
      return { options, consumed: 1 };
    case "--transport":
      options.transport = next ?? "";
      return { options, consumed: 1 };
    case "--runs":
      options.runs = Number.parseInt(next ?? "", 10);
      return { options, consumed: 1 };
    case "--prompt":
      options.prompt = next ?? "";
      return { options, consumed: 1 };
    case "--prompt-target-chars":
      options.promptTargetChars = Number.parseInt(next ?? "", 10);
      return { options, consumed: 1 };
    case "--min-cache-rate":
      options.minCacheRate = Number.parseFloat(next ?? "");
      return { options, consumed: 1 };
    case "--home":
      options.home = next ?? "";
      return { options, consumed: 1 };
    case "--base-url":
      options.baseUrl = next ?? "";
      return { options, consumed: 1 };
    case "--port":
      options.port = next ?? "";
      return { options, consumed: 1 };
    case "--session-type":
      options.sessionType = next ?? "";
      return { options, consumed: 1 };
    case "--usage-source":
      options.usageSource = next ?? "";
      return { options, consumed: 1 };
    case "--usage-settle-ms":
      options.usageSettleMs = Number.parseInt(next ?? "", 10);
      return { options, consumed: 1 };
    case "--timeout-ms":
      options.timeoutMs = Number.parseInt(next ?? "", 10);
      return { options, consumed: 1 };
    case "--json":
      options.json = true;
      return { options, consumed: 0 };
    case "--help":
      printHelp();
      process.exit(0);
      return { options, consumed: 0 };
    default:
      fail(`Unknown argument: ${arg}`, options.json);
      return { options, consumed: 0 };
  }
}

export function parseArgs(argv) {
  let options = {
    model: "",
    transport: DEFAULT_TRANSPORT,
    runs: DEFAULT_RUNS,
    prompt: "",
    promptTargetChars: DEFAULT_PROMPT_TARGET_CHARS,
    minCacheRate: DEFAULT_MIN_CACHE_RATE,
    home: process.env.NEXTCLAW_HOME?.trim() || resolve(homedir(), ".nextclaw"),
    baseUrl: "",
    port: String(DEFAULT_PORT),
    sessionType: DEFAULT_SESSION_TYPE,
    usageSource: DEFAULT_USAGE_SOURCE,
    usageSettleMs: DEFAULT_USAGE_SETTLE_MS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    json: false,
    budgetUsd: 0.10,
    maxCalls: 18,
    maxOutputTokens: 512,
    prices: null,
    output: "",
    baseline: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    const parsed = applyArgument(options, arg, argv[index + 1]);
    options = parsed.options;
    index += parsed.consumed;
  }

  assertOptionRanges(options);
  if (options.transport === "task-suite" && !argv.includes("--min-cache-rate")) options.minCacheRate = 0.8;
  options.home = resolve(options.home.trim());
  normalizeBaseUrl(options);
  return options;
}

export function toPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}


export function printPretty(result) {
  console.log("Prompt Cache Smoke");
  console.log(`Status: ${result.status}`);
  console.log(`Reason: ${result.reason}`);
  console.log(`Mode: ${result.mode}`);
  console.log(`Model: ${result.model}`);
  if (result.configPath) {
    console.log(`Config path: ${result.configPath}`);
  }
  if (result.baseUrl) {
    console.log(`Base URL: ${result.baseUrl}`);
  }
  if (result.sessionType) {
    console.log(`Session type: ${result.sessionType}`);
  }
  if (result.sessionMode) {
    console.log(`Session mode: ${result.sessionMode}`);
  }
  if (result.usageLogPath) {
    console.log(`Usage log: ${result.usageLogPath}`);
  }
  console.log(`System prompt chars: ${result.systemPromptChars}`);
  console.log(
    `Warmup: prompt=${result.warmup.promptTokens} cached=${result.warmup.cachedTokens} keys=${result.warmup.cacheMetricKeys.join(",") || "-"}`,
  );
  console.log(
    `Later runs: hits=${result.laterRuns.cacheHitRuns}/${result.laterRuns.count} prompt=${result.laterRuns.promptTokens} cached=${result.laterRuns.cachedTokens} cache-rate=${toPercent(result.laterRuns.cacheRate)}`,
  );
  console.log("");
  for (const run of result.runs) {
    console.log(
      `Run ${run.run}: prompt=${run.promptTokens} cached=${run.cachedTokens} total=${run.totalTokens} finish=${run.finishReason} reply=${JSON.stringify(run.content.trim())} usage=${run.usageFound ? "yes" : "no"} keys=${run.cacheMetricKeys.join(",") || "-"}`,
    );
  }
}

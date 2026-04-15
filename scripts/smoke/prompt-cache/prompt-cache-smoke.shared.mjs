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
export const DEFAULT_EXPECTED_REPLY = "CACHE-SMOKE-OK";
export const SESSION_TYPE_READY_POLL_MS = 500;

export function printHelp() {
  console.log(`Usage: pnpm smoke:prompt-cache -- --model <id> [options]

Options:
  --model <id>               Real model to test, e.g. minimax/MiniMax-M2.7
  --transport <mode>         provider-direct or ncp-chat (default: ${DEFAULT_TRANSPORT})
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

function assertOptionRanges(options) {
  if (!options.model.trim()) {
    fail("--model is required", options.json);
  }
  if (!["provider-direct", "ncp-chat"].includes(options.transport.trim())) {
    fail("--transport must be provider-direct or ncp-chat", options.json);
  }
  if (!Number.isFinite(options.runs) || options.runs < 2) {
    fail("--runs must be an integer >= 2", options.json);
  }
  if (!Number.isFinite(options.promptTargetChars) || options.promptTargetChars < 2_000) {
    fail("--prompt-target-chars must be an integer >= 2000", options.json);
  }
  if (!Number.isFinite(options.minCacheRate) || options.minCacheRate < 0 || options.minCacheRate > 1) {
    fail("--min-cache-rate must be between 0 and 1", options.json);
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1_000) {
    fail("--timeout-ms must be an integer >= 1000", options.json);
  }
  if (!Number.isFinite(options.usageSettleMs) || options.usageSettleMs < 0) {
    fail("--usage-settle-ms must be an integer >= 0", options.json);
  }
  if (!options.home.trim()) {
    fail("--home cannot be empty", options.json);
  }
  if (!options.sessionType.trim()) {
    fail("--session-type cannot be empty", options.json);
  }
  if (!options.usageSource.trim()) {
    fail("--usage-source cannot be empty", options.json);
  }
}

function applyArgument(options, arg, next) {
  switch (arg) {
    case "--model":
      options.model = next ?? "";
      return 1;
    case "--transport":
      options.transport = next ?? "";
      return 1;
    case "--runs":
      options.runs = Number.parseInt(next ?? "", 10);
      return 1;
    case "--prompt":
      options.prompt = next ?? "";
      return 1;
    case "--prompt-target-chars":
      options.promptTargetChars = Number.parseInt(next ?? "", 10);
      return 1;
    case "--min-cache-rate":
      options.minCacheRate = Number.parseFloat(next ?? "");
      return 1;
    case "--home":
      options.home = next ?? "";
      return 1;
    case "--base-url":
      options.baseUrl = next ?? "";
      return 1;
    case "--port":
      options.port = next ?? "";
      return 1;
    case "--session-type":
      options.sessionType = next ?? "";
      return 1;
    case "--usage-source":
      options.usageSource = next ?? "";
      return 1;
    case "--usage-settle-ms":
      options.usageSettleMs = Number.parseInt(next ?? "", 10);
      return 1;
    case "--timeout-ms":
      options.timeoutMs = Number.parseInt(next ?? "", 10);
      return 1;
    case "--json":
      options.json = true;
      return 0;
    case "--help":
      printHelp();
      process.exit(0);
      return 0;
    default:
      fail(`Unknown argument: ${arg}`, options.json);
      return 0;
  }
}

export function parseArgs(argv) {
  const options = {
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
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    index += applyArgument(options, arg, argv[index + 1]);
  }

  assertOptionRanges(options);
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

export function buildStablePrompt(options) {
  if (options.prompt.trim()) {
    return options.prompt.trim();
  }
  const lines = [
    "Prompt cache smoke test.",
    "Read the stable reference below and follow the final instruction exactly.",
    "",
    "Stable reference document begins below.",
  ];
  let index = 1;
  while (lines.join("\n").length < options.promptTargetChars) {
    const label = String(index).padStart(3, "0");
    lines.push(
      `Section ${label}: NextClaw unifies software, services, internet resources, and cloud actions into one intent-first operating layer. ` +
        "This paragraph is intentionally repeated to create a large stable prompt prefix for provider-level prompt-cache verification. " +
        "The content must stay identical across repeated runs so cache-capable providers can reuse the same prefix efficiently.",
    );
    index += 1;
  }
  lines.push("");
  lines.push(`Final instruction source of truth: the assistant must reply exactly ${DEFAULT_EXPECTED_REPLY}.`);
  return lines.join("\n");
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

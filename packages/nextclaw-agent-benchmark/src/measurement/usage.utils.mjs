import { createHash } from "node:crypto";

export const BENCHMARK_VERSION = "nextclaw.prompt-cache/v1";
export const PRICE_SNAPSHOT = {
  model: "deepseek-v4-flash", currency: "USD", checkedAt: "2026-09-07",
  source: "https://api-docs.deepseek.com/quick_start/pricing/",
  offPeak: { input: 0.22, cached: 0.007, output: 0.66 },
  peak: { input: 0.44, cached: 0.014, output: 1.32 },
};

export function pricesAt(timestamp, override) {
  if (override) return override;
  const date = new Date(timestamp);
  const hour = date.getUTCHours();
  const weekday = date.getUTCDay() >= 1 && date.getUTCDay() <= 5;
  return weekday && ((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10))
    ? PRICE_SNAPSHOT.peak : PRICE_SNAPSHOT.offPeak;
}

export function readUsage(raw) {
  const number = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const input = number(raw?.prompt_tokens ?? raw?.input_tokens);
  const output = number(raw?.completion_tokens ?? raw?.output_tokens);
  const cached = number(raw?.prompt_cache_hit_tokens ?? raw?.prompt_tokens_details?.cached_tokens
    ?? raw?.prompt_tokens_details_cached_tokens ?? raw?.input_tokens_details?.cached_tokens);
  const complete = input !== null && output !== null && cached !== null && cached <= input;
  return { input, output, cached, complete,
    reasoning: number(raw?.completion_tokens_details?.reasoning_tokens),
    cacheRate: complete && input > 0 ? cached / input : null };
}

export function estimateCost(usage, prices) {
  if (!usage.complete) return null;
  return ((usage.input - usage.cached) * prices.input + usage.cached * prices.cached
    + usage.output * prices.output) / 1e6;
}

export function summarizeCalls(calls) {
  const complete = calls.length > 0 && calls.every((call) => call.tokens?.complete);
  const sum = (field) => calls.reduce((total, call) => total + (call.tokens?.[field] ?? 0), 0);
  const input = sum("input"), cached = sum("cached");
  return { calls: calls.length, reportedCalls: calls.filter((call) => call.tokens?.complete).length,
    complete, inputTokens: input, cachedInputTokens: cached, outputTokens: sum("output"),
    reasoningTokens: sum("reasoning"), cacheRate: complete && input ? cached / input : null,
    estimatedCostUsd: complete ? calls.reduce((total, call) => total + call.estimatedCostUsd, 0) : null,
    prefixRewrites: calls.filter((call) => call.prefix?.historyRewritten).length };
}

export function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

// JSON characters are a diagnostic proxy, not the provider's tokenizer/cache boundary.
export function comparePrefix(previous, current) {
  if (!previous) return null;
  const left = JSON.stringify(previous.messages), right = JSON.stringify(current.messages);
  let commonChars = 0;
  while (commonChars < Math.min(left.length, right.length) && left[commonChars] === right[commonChars]) commonChars++;
  const oldMessages = previous.messages ?? [];
  const stableMessages = oldMessages.every((message, index) => hash(message) === hash(current.messages?.[index]));
  const toolsStable = hash(previous.tools ?? []) === hash(current.tools ?? []);
  return { commonChars, previousChars: left.length, toolsStable,
    historyRewritten: !stableMessages || !toolsStable };
}

export class RequestBudget {
  used = 0;
  calls = 0;
  constructor(limit, maxCalls) { this.limit = limit; this.maxCalls = maxCalls; }
  reserve = (body, prices) => {
    // A UTF-8 byte per input token plus protocol overhead deliberately overestimates text inputs.
    const bytes = Buffer.byteLength(JSON.stringify(body));
    if (bytes > 250_000) throw new Error("Input size budget exceeded");
    const upper = ((bytes + 4096) * prices.input + body.max_tokens * prices.output) / 1e6;
    if (this.calls >= this.maxCalls || this.used + upper > this.limit) throw new Error("Request cost/call budget exceeded before dispatch");
    this.calls++;
    this.used += upper;
    return (actual) => { if (actual !== null) this.used += actual - upper; };
  }
}

export function compareReports(baseline, current) {
  const compatible = baseline.schema === current.schema && baseline.model === current.model
    && baseline.fixtureVersion === current.fixtureVersion && baseline.settingsHash === current.settingsHash;
  if (!compatible) throw new Error("Baseline model, fixture or settings differ; comparison refused");
  const scenarios = current.scenarios.map((scenario) => {
    const previous = baseline.scenarios.find((entry) => entry.name === scenario.name);
    const delta = (key) => previous?.all[key] == null || scenario.all[key] == null ? null : scenario.all[key] - previous.all[key];
    return { scenario: scenario.name, baselinePassed: previous?.passed ?? null, passed: scenario.passed,
      inputTokenDelta: delta("inputTokens"), costUsdDelta: delta("estimatedCostUsd"),
      cacheRateDelta: delta("cacheRate"), prefixRewriteDelta: delta("prefixRewrites") };
  });
  return { golden: { before: baseline.golden?.cacheHitRate ?? null, after: current.golden?.cacheHitRate ?? null,
    beforeTaskCompleted: baseline.golden?.taskCompleted ?? false, afterTaskCompleted: current.golden?.taskCompleted ?? false }, scenarios };
}

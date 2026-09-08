// Loaded only in isolated benchmark workers (including the official DSH SDK child).
import { appendFileSync, readFileSync, writeFileSync, mkdirSync, rmdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { RequestBudget, pricesAt, readUsage, estimateCost, comparePrefix, hash } from "./usage.utils.mjs";

function updateLedger(path, change) {
  const lock = `${path}.lock`;
  mkdirSync(lock); // Concurrent owners fail before dispatch instead of racing the shared ceiling.
  try {
    const ledger = JSON.parse(readFileSync(path, "utf8"));
    const result = change(ledger);
    writeFileSync(path, JSON.stringify(result.ledger) + "\n", { mode: 0o600 });
    return result.value;
  } finally { rmdirSync(lock); }
}

function reserveRequest(config, body, prices) {
  const { ledgerPath } = config;
  const reservation = updateLedger(ledgerPath, (ledger) => {
    const budget = new RequestBudget(ledger.limit, ledger.maxCalls);
    budget.used = ledger.used; budget.calls = ledger.calls;
    budget.reserve(body, prices);
    return { ledger: { ...ledger, used: budget.used, calls: budget.calls },
      value: { number: budget.calls, upper: budget.used - ledger.used } };
  });
  return { number: reservation.number, settle: (actual) => {
    if (actual === null) return;
    updateLedger(ledgerPath, (ledger) => ({ ledger: { ...ledger, used: ledger.used + actual - reservation.upper } }));
  } };
}

function observeResponse(response, call, reservation, tracePath) {
  let pending = "", recorded = false;
  const decoder = new TextDecoder();
  const consume = () => {
    let boundary;
    while ((boundary = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, boundary).trim(); pending = pending.slice(boundary + 1);
      if (!line.startsWith("data:") || line.slice(5).trim() === "[DONE]") continue;
      const data = JSON.parse(line.slice(5));
      call.finishReason = data.choices?.find((choice) => choice.finish_reason)?.finish_reason ?? call.finishReason;
      if (!data.usage || recorded) continue;
      recorded = true;
      call.rawUsage = data.usage; call.tokens = readUsage(data.usage);
      call.estimatedCostUsd = estimateCost(call.tokens, call.prices);
      call.elapsedMs = Date.now() - Date.parse(call.startedAt);
      reservation.settle(call.estimatedCostUsd);
      appendFileSync(tracePath, JSON.stringify(call) + "\n");
    }
  };
  return new globalThis.Response(response.body.pipeThrough(new globalThis.TransformStream({
    transform: (chunk, controller) => { controller.enqueue(chunk); pending += decoder.decode(chunk, { stream: true }); consume(); },
    flush: () => { pending += decoder.decode() + "\n"; consume(); },
  })), { status: response.status, statusText: response.statusText, headers: response.headers });
}

const configPath = process.env.NEXTCLAW_BENCHMARK_WORKER_CONFIG;
if (!configPath) throw new Error("Benchmark observer requires an isolated worker config");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const original = globalThis.fetch;
let previous = null;
globalThis.fetch = async (url, init) => {
  if (new URL(typeof url === "string" ? url : url.url ?? url).hostname !== "api.deepseek.com") return original(url, init);
  const source = init?.body ?? (typeof url?.clone === "function" ? await url.clone().text() : null);
  if (!source) return original(url, init);
  const body = JSON.parse(source);
  if (body.model !== "deepseek-v4-flash" || (!body.stream && !config.allowNonStreaming)) throw new Error("Unexpected paid benchmark route");
  if (body.stream && ((body.thinking?.type ?? "enabled") !== "enabled" || (body.reasoning_effort ?? "high") !== "high")) {
    throw new Error("Benchmark requires the same enabled/high reasoning mode for both harnesses");
  }
  body.max_tokens = Math.min(body.max_tokens ?? config.maxOutputTokens, config.maxOutputTokens);
  if (previous === null) {
    writeFileSync(join(dirname(config.tracePath), "context-profile.json"), JSON.stringify({
      measurement: "characters-not-tokens", environmentProfile: "clean-home-v1",
      messages: body.messages.map((message) => ({ role: message.role,
        chars: JSON.stringify(message.content ?? "").length,
        sections: typeof message.content === "string" ? message.content.split(/(?=^#{1,2} )/m)
          .map((section) => ({ heading: section.split("\n")[0].slice(0, 100), chars: section.length })) : [] })),
      tools: (body.tools ?? []).map((tool) => ({ name: tool.function?.name, chars: JSON.stringify(tool).length })),
    }, null, 2) + "\n", { mode: 0o600 });
  }
  const startedAt = new Date().toISOString(), prices = pricesAt(startedAt, config.prices);
  const deadlinePrices = pricesAt(Date.now() + config.timeoutMs, config.prices);
  const ceilingPrices = Object.fromEntries(Object.keys(prices).map((key) => [key, Math.max(prices[key], deadlinePrices[key])]));
  const reservation = reserveRequest(config, body, ceilingPrices);
  const call = { number: reservation.number, startedAt, prices, model: body.model, maxOutputTokens: body.max_tokens,
    streaming: Boolean(body.stream),
    thinking: body.thinking ?? null, reasoningEffort: body.reasoning_effort ?? null, temperature: body.temperature ?? null,
    messageCount: body.messages.length, toolCount: body.tools?.length ?? 0,
    toolsHash: hash(body.tools ?? []),
    toolNames: (body.tools ?? []).map((tool) => tool.function?.name),
    messageChars: JSON.stringify(body.messages).length, toolChars: JSON.stringify(body.tools ?? []).length,
    prefix: comparePrefix(previous, body), requestHash: hash(body),
    toolHistory: body.messages.filter((message) => message.tool_calls).flatMap((message) => message.tool_calls),
    tokens: null, estimatedCostUsd: null, finishReason: null };
  previous = body;
  appendFileSync(config.tracePath, JSON.stringify(call) + "\n", { mode: 0o600 });
  return dispatchObservedRequest(url, init, body, call, reservation);
};

async function dispatchObservedRequest(url, init, body, call, reservation) {
  const headers = new globalThis.Headers(init?.headers ?? url?.headers);
  headers.delete("content-length"); // The SDK length describes its original body, before the output cap/re-serialization.
  let response;
  try {
    response = await original(url, { ...init, headers, body: JSON.stringify(body),
      signal: globalThis.AbortSignal.any([...((init?.signal ?? url?.signal) ? [init?.signal ?? url.signal] : []), globalThis.AbortSignal.timeout(config.timeoutMs)]) });
  } catch (error) {
    call.elapsedMs = Date.now() - Date.parse(call.startedAt);
    call.failure = { name: error.name, code: error.cause?.code ?? error.code ?? null };
    appendFileSync(config.tracePath, JSON.stringify(call) + "\n");
    throw error;
  }
  call.httpStatus = response.status;
  if (!response.ok || !response.body) {
    call.elapsedMs = Date.now() - Date.parse(call.startedAt);
    call.failure = !response.ok ? `HTTP ${response.status}` : "Response has no body";
    appendFileSync(config.tracePath, JSON.stringify(call) + "\n");
    return response;
  }
  if (!body.stream) {
    const data = await response.clone().json();
    call.rawUsage = data.usage;
    call.tokens = readUsage(data.usage);
    call.finishReason = data.choices?.[0]?.finish_reason ?? null;
    call.estimatedCostUsd = estimateCost(call.tokens, call.prices);
    call.elapsedMs = Date.now() - Date.parse(call.startedAt);
    reservation.settle(call.estimatedCostUsd);
    appendFileSync(config.tracePath, JSON.stringify(call) + "\n");
    return response;
  }
  return observeResponse(response, call, reservation, config.tracePath);
}

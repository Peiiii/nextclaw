import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { readUsage, estimateCost, summarizeCalls, comparePrefix, RequestBudget, pricesAt, compareReports } from "./usage.utils.mjs";

test("non-streaming OpenAI SDK requests use the observed and budgeted transport", () => {
  const directory = mkdtempSync(join(tmpdir(), "benchmark-sdk-observer-"));
  try {
    const tracePath = join(directory, "trace.jsonl"), ledgerPath = join(directory, "budget.json"), configPath = join(directory, "config.json");
    writeFileSync(ledgerPath, JSON.stringify({ used: 0, calls: 0, limit: 0.01, maxCalls: 1 }));
    writeFileSync(configPath, JSON.stringify({ tracePath, ledgerPath, timeoutMs: 1000, maxOutputTokens: 32, allowNonStreaming: true }));
    execFileSync(process.execPath, ["--input-type=module", "--eval", `
      globalThis.fetch = async (_url, init) => {
        if(new Headers(init.headers).has('content-length')) throw new Error('Stale SDK content length');
        if(JSON.parse(init.body).max_tokens !== 32) throw new Error('Missing output cap');
        return new Response(JSON.stringify({id:'test',choices:[{finish_reason:'stop',message:{role:'assistant',content:'ok'}}],usage:{prompt_tokens:100,completion_tokens:5,prompt_cache_hit_tokens:80}}), {headers:{'content-type':'application/json'}});
      };
      const {installNextclawBenchmarkObserver} = await import('@nextclaw/agent-benchmark');
      await installNextclawBenchmarkObserver();
      const {default: OpenAI} = await import('openai');
      const client = new OpenAI({apiKey:'fixture',baseURL:'https://api.deepseek.com',maxRetries:0});
      await client.chat.completions.create({model:'deepseek-v4-flash',messages:[{role:'user',content:'fixture'}],stream:false});
    `], { cwd: fileURLToPath(new URL("../../", import.meta.url)), env: { ...process.env, NEXTCLAW_BENCHMARK_WORKER_CONFIG: configPath }, stdio: "pipe" });
    const calls = readFileSync(tracePath, "utf8").trim().split("\n").map(JSON.parse);
    assert.equal(calls.at(-1).tokens.cached, 80);
    assert.equal(calls.at(-1).streaming, false);
    assert.equal(JSON.parse(readFileSync(ledgerPath, "utf8")).calls, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("missing cache telemetry is unknown, not zero; duplicate fields are not summed", () => {
  assert.equal(readUsage({ prompt_tokens: 100, completion_tokens: 5 }).complete, false);
  const tokens = readUsage({ prompt_tokens: 100, completion_tokens: 5, prompt_cache_hit_tokens: 80,
    prompt_tokens_details: { cached_tokens: 80 } });
  assert.equal(tokens.cached, 80);
  assert.equal(readUsage({ prompt_tokens: 10, completion_tokens: 1, prompt_cache_hit_tokens: 20 }).complete, false);
  assert.equal(estimateCost(tokens, { input: 1, cached: 0.1, output: 2 }), 38 / 1e6);
});
test("cold first call makes 99% warm cache appear 66% cumulatively", () => {
  const calls = [0, 99, 99].map((cached) => ({ tokens: readUsage({ prompt_tokens: 100, completion_tokens: 1, prompt_cache_hit_tokens: cached }), estimatedCostUsd: 0.01 }));
  assert.equal(summarizeCalls(calls).cacheRate, 0.66);
  assert.equal(summarizeCalls(calls.slice(1)).cacheRate, 0.99);
});
test("budget rejects before network dispatch and keeps unknown charges reserved", () => {
  const budget = new RequestBudget(0.01, 2);
  const body = { messages: [], max_tokens: 10 };
  const settle = budget.reserve(body, { input: 1, output: 1 });
  const reserved = budget.used; settle(null); assert.equal(budget.used, reserved);
  budget.reserve(body, { input: 1, output: 1 })(0.0001);
  assert.throws(() => budget.reserve(body, { input: 1, output: 1 }), /budget/);
  assert.throws(() => new RequestBudget(0.00001, 2).reserve(body, { input: 1, output: 1 }), /budget/);
});
test("detects rewritten old assistant and changed tools but permits append", () => {
  const old = { messages: [{ role: "assistant", content: "a" }] };
  assert.equal(comparePrefix(old, { messages: [...old.messages, { role: "user", content: "b" }] }).historyRewritten, false);
  assert.equal(comparePrefix(old, { messages: [{ role: "assistant", content: "ab" }] }).historyRewritten, true);
  assert.equal(comparePrefix(old, { ...old, tools: ["new"] }).historyRewritten, true);
});
test("price snapshot respects UTC peak windows and explicit prices", () => {
  assert.equal(pricesAt("2026-09-07T02:00:00Z").input, 0.44);
  assert.equal(pricesAt("2026-09-07T15:00:00Z").input, 0.22);
  assert.equal(pricesAt("2026-09-06T02:00:00Z").input, 0.22);
  assert.equal(pricesAt("2026-09-07T02:00:00Z", { input: 9 }).input, 9);
});
test("rejects incompatible historical comparison", () => {
  assert.throws(() => compareReports({ schema: "old" }, { schema: "new" }), /refused/);
});

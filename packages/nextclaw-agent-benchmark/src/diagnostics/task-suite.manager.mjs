import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { Contribution, NextclawHarness } from "@nextclaw/kernel";
import { loadConfig, resolveConfigSecrets } from "@nextclaw/core";
import { buildStablePrompt, DEFAULT_EXPECTED_REPLY } from "#benchmark/tasks/fixed-prefix.utils.mjs";
import { TASK_FIXTURES, prepareTaskFixture } from "#benchmark/tasks/fixtures.config.mjs";
import {
  BENCHMARK_VERSION, PRICE_SNAPSHOT, RequestBudget, comparePrefix, compareReports,
  estimateCost, hash, pricesAt, readUsage, summarizeCalls,
} from "#benchmark/measurement/usage.utils.mjs";

class BenchmarkContribution extends Contribution {
  constructor() { super({ id: "prompt-cache-benchmark" }); }
  setup = () => { this.models = this.kernel.models; };
}

function observeStreamUsage(response, finish, settleUsage) {
  if (!response.body) return response;
  let pending = "";
  const decoder = new TextDecoder();
  const consume = () => {
    let boundary;
    while ((boundary = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, boundary).trim(); pending = pending.slice(boundary + 1);
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      const data = JSON.parse(line.slice(6));
      if (data.usage) finish(data.usage);
    }
  };
  return new globalThis.Response(response.body.pipeThrough(new globalThis.TransformStream({
    transform: (chunk, controller) => { controller.enqueue(chunk); pending += decoder.decode(chunk, { stream: true }); consume(); },
    flush: () => { pending += decoder.decode() + "\n"; consume(); settleUsage(); },
  })), { status: response.status, statusText: response.statusText, headers: response.headers });
}

// Runs in a dedicated CLI process. Only synthetic request structure and usage leave it.
class RequestObserver {
  calls = [];
  scenario = "startup";
  previous = null;
  constructor(options, signalController) {
    this.options = options;
    this.controller = signalController;
    this.budget = new RequestBudget(options.budgetUsd, options.maxCalls);
  }
  begin = (name) => { this.scenario = name; this.previous = null; };
  signal = () => globalThis.AbortSignal.any([this.controller.signal, globalThis.AbortSignal.timeout(this.options.timeoutMs)]);
  install = () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      if (new URL(typeof url === "string" ? url : url.url ?? url).hostname !== "api.deepseek.com" || !init?.body) {
        return original(url, init);
      }
      const body = JSON.parse(init.body);
      if (!Array.isArray(body.messages)) return original(url, init);
      if (body.model !== "deepseek-v4-flash") throw new Error("Unexpected paid model; benchmark stopped");
      body.max_tokens = Math.min(body.max_tokens ?? this.options.maxOutputTokens, this.options.maxOutputTokens);
      const startedAt = new Date().toISOString();
      const prices = pricesAt(startedAt, this.options.prices);
      let settle;
      try {
        settle = this.budget.reserve(body, this.options.prices ?? PRICE_SNAPSHOT.peak);
      } catch (error) { this.controller.abort(error); throw error; }
      const call = { number: this.calls.length + 1, scenario: this.scenario, startedAt, prices,
        model: body.model, maxOutputTokens: body.max_tokens,
        requestHash: hash(body), messageCount: body.messages.length, toolCount: body.tools?.length ?? 0,
        messageChars: JSON.stringify(body.messages).length, toolChars: JSON.stringify(body.tools ?? []).length,
        thinking: body.thinking ?? null, reasoningEffort: body.reasoning_effort ?? null,
        prefix: comparePrefix(this.previous, body), tokens: null, estimatedCostUsd: null };
      this.previous = body;
      this.calls.push(call);
      let settled = false;
      const finish = (raw) => {
        call.rawUsage = raw;
        call.tokens = readUsage(raw);
        call.estimatedCostUsd = estimateCost(call.tokens, prices);
        call.elapsedMs = Date.now() - Date.parse(startedAt);
      };
      const settleUsage = () => { if (!settled) { settle(call.estimatedCostUsd); settled = true; } };
      const response = await original(url, { ...init, body: JSON.stringify(body),
        signal: init.signal ? globalThis.AbortSignal.any([init.signal, this.controller.signal]) : this.controller.signal });
      call.httpStatus = response.status;
      if (!body.stream) {
        const data = await response.clone().json();
        finish(data.usage);
        settleUsage();
        return response;
      }
      return observeStreamUsage(response, finish, settleUsage);
    };
    return () => { globalThis.fetch = original; };
  }
}

function createFileFixture(workspace) {
  const files = TASK_FIXTURES.files.files;
  const prompts = prepareTaskFixture("files", workspace, "read_file");
  return { names: Object.keys(files).map((path) => path.slice(0, -4)), fixture: Object.values(files), prompts };
}

function prepareEnvironment({
  model, home: sourceHome, baseline: baselinePath, output
}) {
    if (model !== "deepseek/deepseek-v4-flash") throw new Error("Task benchmark currently targets deepseek/deepseek-v4-flash only");
    const configPath = resolve(sourceHome, "config.json");
    const baseline = baselinePath ? JSON.parse(readFileSync(baselinePath, "utf8")) : null;
    const config = resolveConfigSecrets(loadConfig(configPath), { configPath });
    const provider = config.providers.deepseek;
    if (!provider.apiKey || (provider.apiBase && !/^https:\/\/api\.deepseek\.com(?:\/v1)?\/?$/.test(provider.apiBase))) {
      throw new Error("Benchmark requires a configured official DeepSeek API route");
    }
    const reportPath = output ? resolve(output)
      : resolve(sourceHome, "diagnostics", "prompt-cache", `${new Date().toISOString().replaceAll(":", "-")}.json`);
    mkdirSync(dirname(reportPath), { recursive: true });
    const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
    const sourceFingerprint = hash([
      "packages/ncp-packages/nextclaw-ncp-agent-runtime/src/runtime/utils/message-converter.utils.ts",
      "packages/ncp-packages/nextclaw-ncp-agent-runtime-next/src/runtime/agent-runtime.service.ts",
      "packages/nextclaw-kernel/src/features/harness/managers/nextclaw-kernel-capability.manager.ts",
    ].map((path) => [path, hash(readFileSync(join(repository, path), "utf8"))]));
    const home = mkdtempSync(join(tmpdir(), "nextclaw-cache-benchmark-"));
    const workspace = join(home, "workspace"); mkdirSync(workspace);
    const keyName = "NEXTCLAW_CACHE_BENCHMARK_API_KEY";
    const previousKey = process.env[keyName], previousHome = process.env.NEXTCLAW_HOME;
    process.env[keyName] = provider.apiKey; process.env.NEXTCLAW_HOME = home;
    writeFileSync(join(home, "config.json"), JSON.stringify({
      agents: { defaults: { model, workspace, thinkingDefault: "off" } },
      providers: { deepseek: { enabled: true, apiKey: "", apiBase: provider.apiBase, models: ["deepseek-v4-flash"] } },
      secrets: { refs: { "providers.deepseek.apiKey": { source: "env", id: keyName } } },
    }), { mode: 0o600 });
    return { home, workspace, reportPath, sourceFingerprint, baseline, dispose: () => {
      if (previousKey === undefined) delete process.env[keyName]; else process.env[keyName] = previousKey;
      if (previousHome === undefined) delete process.env.NEXTCLAW_HOME; else process.env.NEXTCLAW_HOME = previousHome;
      rmSync(home, { recursive: true, force: true });
    } };
}

function buildReport({ options, environment, observer, scenarios, settings, startedAt, failure }) {
    const { baseline, reportPath, sourceFingerprint } = environment;
    const all = summarizeCalls(observer.calls);
    const golden = scenarios.find((scenario) => scenario.name === "file-investigation");
    const report = { schema: BENCHMARK_VERSION, fixtureVersion: 1, model: options.model, startedAt,
      golden: { id: "file-investigation-total-v1", label: "固定真实任务整体缓存命中率",
        cacheHitRate: golden?.all.cacheRate ?? null, taskCompleted: golden?.checks.every((check) => check.passed) ?? false,
        includesColdStart: true, definition: "sum(cached input tokens) / sum(input tokens), all calls in the five-file task and follow-up" },
      endedAt: new Date().toISOString(), revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      dirty: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()),
      sourceFingerprint, reportPath, settings, settingsHash: hash(settings), priceSnapshot: options.prices ? { currency: "USD", override: options.prices } : PRICE_SNAPSHOT,
      costKind: "provider-usage-times-price-estimate-not-invoice", budgetUsd: options.budgetUsd,
      reservedOrSpentUpperUsd: observer.budget.used, all, scenarios, calls: observer.calls,
      failure, ok: !failure && scenarios.length > 0 && scenarios.every((scenario) => scenario.passed) && all.complete };
    if (baseline && !failure) report.comparison = compareReports(baseline, report);
    report.gates = { minimumGoldenCacheRate: options.minCacheRate,
      maxGoldenDrop: 0.05, regression: baseline?.golden?.cacheHitRate != null && report.golden.cacheHitRate != null
        ? baseline.golden.cacheHitRate - report.golden.cacheHitRate > 0.05 : null };
    report.ok &&= report.golden.cacheHitRate !== null && report.golden.cacheHitRate >= options.minCacheRate && !report.gates.regression;
    report.status = report.ok ? "PASS" : "FAIL";
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
    return report;
}

export class HarnessPromptCacheSmokeRunner {
  constructor(options) { this.options = options; }
  run = async () => {
    const options = this.options;
    const environment = prepareEnvironment(options);
    const { home, workspace, baseline } = environment;
    const controller = new AbortController();
    const observer = new RequestObserver(options, controller);
    const restoreFetch = observer.install();
    const harness = new NextclawHarness({ homeDir: home, configPath: join(home, "config.json") });
    const contribution = new BenchmarkContribution(); harness.contributions.register(contribution);
    const scenarios = [];
    const startedAt = new Date().toISOString();
    const settings = { runs: options.runs, promptTargetChars: options.promptTargetChars,
      promptHash: hash(options.prompt), maxOutputTokens: options.maxOutputTokens, transport: options.transport,
      fixtureLines: 60, thinkingDefault: "off", provider: "https://api.deepseek.com", prices: options.prices ?? PRICE_SNAPSHOT };
    let failure = null;
    const runScenario = async (name, execute) => {
      observer.begin(name); const firstCall = observer.calls.length; const start = Date.now();
      const checks = await execute();
      const calls = observer.calls.slice(firstCall);
      const all = summarizeCalls(calls), warm = summarizeCalls(calls.slice(1));
      const passed = checks.every((check) => check.passed) && all.complete && all.prefixRewrites === 0;
      scenarios.push({ name, passed, checks, elapsedMs: Date.now() - start, all, warm });
      console.error(`[prompt-cache] ${name}: ${passed ? "PASS" : "FAIL"}; calls=${calls.length}; warm=${warm.cacheRate?.toFixed(4)}; USD=${all.estimatedCostUsd?.toFixed(6)}`);
    };
    try {
      if (baseline) compareReports(baseline, { schema: BENCHMARK_VERSION, model: options.model,
        fixtureVersion: 1, settingsHash: hash(settings), scenarios: [] });
      await harness.start();
      await runScenario("fixed-prefix", async () => {
        const checks = [];
        for (let i = 0; i < options.runs; i++) {
          let content = "";
          for await (const event of contribution.models.chatStream({ model: options.model, maxTokens: options.maxOutputTokens,
            thinkingLevel: "off", signal: observer.signal(), messages: [
              { role: "system", content: buildStablePrompt(options) },
              { role: "user", content: `Reply exactly ${DEFAULT_EXPECTED_REPLY}.` },
            ] })) {
            if (event.type === "done") content = event.response.content ?? "";
          }
          checks.push({ name: `reply-${i + 1}`, passed: content.trim() === DEFAULT_EXPECTED_REPLY });
        }
        return checks;
      });
      if (options.transport === "task-suite") {
        await runScenario("conversation", async () => {
          const checks = [];
          for (let i = 0; i < options.runs; i++) {
            const result = await harness.runTask({ sessionId: "benchmark-chat", model: options.model, signal: observer.signal(),
              input: "不要调用工具或修改文件，只回复 CACHE_PROBE_OK。" });
            checks.push({ name: `reply-${i + 1}`, passed: result.text.trim() === "CACHE_PROBE_OK" });
          }
          return checks;
        });
        const { names, fixture, prompts } = createFileFixture(workspace);
        await runScenario("file-investigation", async () => {
          const result = await harness.runTask({ sessionId: "benchmark-files", model: options.model, signal: observer.signal(),
            input: prompts[0] });
          const invocations = result.completedMessage?.parts.filter((part) => part.type === "tool-invocation") ?? [];
          const readPaths = invocations.filter((part) => part.toolName === "read_file" && part.state === "result")
            .map((part) => {
              const args = typeof part.args === "string" ? JSON.parse(part.args) : part.args;
              return typeof args?.path === "string" ? resolve(workspace, args.path) : null;
            });
          const followup = await harness.runTask({ sessionId: "benchmark-files", model: options.model, signal: observer.signal(),
            input: prompts[1] });
          return [
            { name: "correct-total", passed: /TOTAL\s*=\s*65\s*;\s*FILES\s*=\s*5/.test(result.text) },
            { name: "all-five-files-read", passed: readPaths.length === names.length
                && names.every((name, i) => readPaths[i] === join(workspace, `${name}.txt`)),
              filesRead: readPaths.map((path) => path?.split("/").at(-1) ?? "missing-path") },
            { name: "read-only-tools", passed: invocations.every((part) => part.toolName === "read_file") },
            { name: "files-unchanged", passed: names.every((name, i) => readFileSync(join(workspace, `${name}.txt`), "utf8") === fixture[i]) },
            { name: "followup-correct", passed: followup.text.trim() === "15" },
            { name: "fixed-seven-model-calls", passed: observer.calls.filter((call) => call.scenario === "file-investigation").length === 7 },
          ];
        });
      }
    } catch (error) { failure = error instanceof Error ? error.message : String(error); }
    finally {
      controller.abort();
      try { await harness.dispose(); } catch (error) { failure ??= String(error); }
      restoreFetch();
      environment.dispose();
    }
    return buildReport({ options, environment, observer, scenarios, settings, startedAt, failure });
  }
}

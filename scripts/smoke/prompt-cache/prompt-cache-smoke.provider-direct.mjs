import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  LiteLLMProvider,
  ProviderManager,
  loadConfig,
  resolveConfigSecrets,
} from "../../../packages/nextclaw-core/src/index.ts";
import {
  buildStablePrompt,
  DEFAULT_EXPECTED_REPLY,
  toPercent,
} from "./prompt-cache-smoke.shared.mjs";

export class ProviderDirectPromptCacheSmokeRunner {
  constructor(options) {
    this.options = options;
    this.configPath = resolve(this.options.home, "config.json");
    this.prompt = buildStablePrompt(options);
  }

  run = async () => {
    if (!existsSync(this.configPath)) {
      throw new Error(`config.json not found under ${this.options.home}`);
    }

    const runs = [];
    const manager = this.createProviderManager();
    for (let index = 0; index < this.options.runs; index += 1) {
      runs.push(await this.runOnce(manager, index + 1));
    }
    return this.buildResult(runs);
  };

  createProviderManager = () => {
    const config = resolveConfigSecrets(loadConfig(this.configPath), { configPath: this.configPath });
    return new ProviderManager({
      defaultProvider: new LiteLLMProvider({
        apiKey: null,
        apiBase: null,
        defaultModel: this.options.model.trim(),
      }),
      config,
    });
  };

  buildMessages = () => {
    return [
      { role: "system", content: this.prompt },
      {
        role: "user",
        content: `Reply exactly ${DEFAULT_EXPECTED_REPLY}. Do not add punctuation, markdown, explanation, or extra words.`,
      },
    ];
  };

  runOnce = async (manager, runNumber) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error(`provider smoke timed out after ${this.options.timeoutMs}ms`));
    }, this.options.timeoutMs);

    try {
      const response = await manager.chat({
        model: this.options.model.trim(),
        messages: this.buildMessages(),
        maxTokens: 32,
        thinkingLevel: "off",
        signal: controller.signal,
      });
      return {
        run: runNumber,
        promptTokens: response.usage.prompt_tokens ?? response.usage.input_tokens ?? 0,
        completionTokens: response.usage.completion_tokens ?? response.usage.output_tokens ?? 0,
        totalTokens: response.usage.total_tokens ?? 0,
        cachedTokens: this.extractCachedTokens(response.usage),
        cacheMetricKeys: Object.keys(response.usage).filter((key) => key.endsWith("cached_tokens")),
        finishReason: response.finishReason,
        content: response.content ?? "",
        usage: response.usage,
        usageFound: true,
      };
    } finally {
      clearTimeout(timer);
    }
  };

  extractCachedTokens = (usage) => {
    return Object.keys(usage)
      .filter((key) => key.endsWith("cached_tokens"))
      .reduce((max, key) => Math.max(max, usage[key] ?? 0), 0);
  };

  buildResult = (runs) => {
    const warmup = runs[0];
    const laterRuns = runs.slice(1);
    const laterPromptTokens = laterRuns.reduce((sum, run) => sum + run.promptTokens, 0);
    const laterCachedTokens = laterRuns.reduce((sum, run) => sum + run.cachedTokens, 0);
    const laterCacheHits = laterRuns.filter((run) => run.cachedTokens > 0).length;
    const laterCacheRate = laterPromptTokens > 0 ? laterCachedTokens / laterPromptTokens : 0;
    const hasCacheTelemetry = laterRuns.some((run) => run.cacheMetricKeys.length > 0);
    const exactReplyCount = runs.filter((run) => run.content.trim() === DEFAULT_EXPECTED_REPLY).length;

    let status = "PASS";
    let reason = `later repeated runs reached ${toPercent(laterCacheRate)} cached/prompt token rate`;
    if (exactReplyCount !== runs.length) {
      status = "FAIL";
      reason = `model reply drifted from expected exact reply in ${runs.length - exactReplyCount} run(s)`;
    } else if (laterPromptTokens === 0) {
      status = "INCONCLUSIVE";
      reason = "later runs did not report prompt tokens, so cache behavior cannot be judged";
    } else if (!hasCacheTelemetry) {
      status = "INCONCLUSIVE";
      reason = "provider did not expose any cached token telemetry in later runs";
    } else if (laterCacheHits === 0) {
      status = "FAIL";
      reason = "later runs exposed telemetry but no cached tokens were reported";
    } else if (laterCacheRate < this.options.minCacheRate) {
      status = "FAIL";
      reason = `later cached/prompt token rate ${toPercent(laterCacheRate)} is below threshold ${toPercent(this.options.minCacheRate)}`;
    }

    return {
      ok: status === "PASS",
      status,
      reason,
      mode: "provider-direct",
      model: this.options.model.trim(),
      home: this.options.home,
      configPath: this.configPath,
      runsRequested: this.options.runs,
      minCacheRate: this.options.minCacheRate,
      systemPromptChars: this.prompt.length,
      expectedReply: DEFAULT_EXPECTED_REPLY,
      warmup: {
        promptTokens: warmup.promptTokens,
        cachedTokens: warmup.cachedTokens,
        cacheMetricKeys: warmup.cacheMetricKeys,
      },
      laterRuns: {
        count: laterRuns.length,
        cacheHitRuns: laterCacheHits,
        promptTokens: laterPromptTokens,
        cachedTokens: laterCachedTokens,
        cacheRate: laterCacheRate,
      },
      runs,
    };
  };
}

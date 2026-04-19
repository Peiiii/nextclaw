import { afterEach, describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { LlmUsageCommandService } from "./llm-usage-command.service.js";
import { LlmUsageQueryService } from "@/cli/shared/services/usage/llm-usage-query.service.js";
import { LlmUsageHistoryStore } from "@/cli/shared/stores/llm-usage-history.store.js";
import { LlmUsageSnapshotStore } from "@/cli/shared/stores/llm-usage-snapshot.store.js";

describe("LlmUsageCommandService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("prints helpful guidance when no snapshot exists", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "nextclaw-usage-command-"));
    const queryService = new LlmUsageQueryService({
      snapshotStore: new LlmUsageSnapshotStore(join(tempDir, "llm-usage.json")),
      historyStore: new LlmUsageHistoryStore(join(tempDir, "llm-usage.jsonl"))
    });
    const commands = new LlmUsageCommandService({ queryService });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await commands.show();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No LLM usage snapshot recorded yet."));
    expect(process.exitCode).toBe(0);
  });

  it("renders the latest cache usage snapshot", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "nextclaw-usage-command-"));
    const snapshotStore = new LlmUsageSnapshotStore(join(tempDir, "llm-usage.json"));
    snapshotStore.write({
      version: 1,
      observedAt: "2026-04-11T01:00:00.000Z",
      source: "cli-agent",
      model: "gpt-test",
      usage: {
        prompt_tokens: 1500,
        completion_tokens: 80,
        total_tokens: 1580,
        prompt_tokens_details_cached_tokens: 1024
      },
      summary: {
        promptTokens: 1500,
        completionTokens: 80,
        totalTokens: 1580,
        cachedTokens: 1024,
        cacheHit: true,
        cacheMetricKeys: ["prompt_tokens_details_cached_tokens"]
      }
    });
    const commands = new LlmUsageCommandService({
      queryService: new LlmUsageQueryService({
        snapshotStore,
        historyStore: new LlmUsageHistoryStore(join(tempDir, "llm-usage.jsonl"))
      })
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await commands.show();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Cached tokens: 1024"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Cache hit: yes"));
    expect(process.exitCode).toBe(0);
  });

  it("renders recent history records", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "nextclaw-usage-command-"));
    const historyStore = new LlmUsageHistoryStore(join(tempDir, "llm-usage.jsonl"));
    historyStore.append({
      version: 1,
      observedAt: "2026-04-11T01:00:00.000Z",
      source: "cli-agent",
      model: "gpt-test",
      usage: { total_tokens: 100 },
      summary: {
        promptTokens: 80,
        completionTokens: 20,
        totalTokens: 100,
        cachedTokens: 0,
        cacheHit: false,
        cacheMetricKeys: []
      }
    });
    historyStore.append({
      version: 1,
      observedAt: "2026-04-11T02:00:00.000Z",
      source: "ui-ncp",
      model: "gpt-test-2",
      usage: { total_tokens: 240, prompt_tokens_details_cached_tokens: 64 },
      summary: {
        promptTokens: 200,
        completionTokens: 40,
        totalTokens: 240,
        cachedTokens: 64,
        cacheHit: true,
        cacheMetricKeys: ["prompt_tokens_details_cached_tokens"]
      }
    });
    const commands = new LlmUsageCommandService({
      queryService: new LlmUsageQueryService({
        snapshotStore: new LlmUsageSnapshotStore(join(tempDir, "llm-usage.json")),
        historyStore
      })
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await commands.show({ history: true, limit: 2 });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Recent LLM usage history"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("source=ui-ncp"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("cache-hit=yes"));
    expect(process.exitCode).toBe(0);
  });

  it("renders aggregated stats from history", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "nextclaw-usage-command-"));
    const historyStore = new LlmUsageHistoryStore(join(tempDir, "llm-usage.jsonl"));
    historyStore.append({
      version: 1,
      observedAt: "2026-04-11T01:00:00.000Z",
      source: "cli-agent",
      model: "gpt-test",
      usage: { total_tokens: 100 },
      summary: {
        promptTokens: 80,
        completionTokens: 20,
        totalTokens: 100,
        cachedTokens: 0,
        cacheHit: false,
        cacheMetricKeys: []
      }
    });
    historyStore.append({
      version: 1,
      observedAt: "2026-04-11T02:00:00.000Z",
      source: "cli-agent",
      model: "gpt-test",
      usage: { total_tokens: 240, prompt_tokens_details_cached_tokens: 64 },
      summary: {
        promptTokens: 200,
        completionTokens: 40,
        totalTokens: 240,
        cachedTokens: 64,
        cacheHit: true,
        cacheMetricKeys: ["prompt_tokens_details_cached_tokens"]
      }
    });
    const commands = new LlmUsageCommandService({
      queryService: new LlmUsageQueryService({
        snapshotStore: new LlmUsageSnapshotStore(join(tempDir, "llm-usage.json")),
        historyStore
      })
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await commands.show({ stats: true });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Records: 2"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage records: 2"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Prompt-bearing records: 2"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Cached tokens: 64"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Cache hit records: 1/2 (50.0%)"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Cache token rate: 22.9%"));
    expect(process.exitCode).toBe(0);
  });

  it("separates empty usage records from prompt-bearing cache stats", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "nextclaw-usage-command-"));
    const historyStore = new LlmUsageHistoryStore(join(tempDir, "llm-usage.jsonl"));
    historyStore.append({
      version: 1,
      observedAt: "2026-04-11T01:00:00.000Z",
      source: "ui-ncp",
      model: "default-model",
      usage: {},
      summary: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cachedTokens: 0,
        cacheHit: false,
        cacheMetricKeys: []
      }
    });
    historyStore.append({
      version: 1,
      observedAt: "2026-04-11T02:00:00.000Z",
      source: "ui-ncp",
      model: "gpt-test",
      usage: { prompt_tokens: 200, completion_tokens: 40, total_tokens: 240, prompt_tokens_details_cached_tokens: 64 },
      summary: {
        promptTokens: 200,
        completionTokens: 40,
        totalTokens: 240,
        cachedTokens: 64,
        cacheHit: true,
        cacheMetricKeys: ["prompt_tokens_details_cached_tokens"]
      }
    });
    const commands = new LlmUsageCommandService({
      queryService: new LlmUsageQueryService({
        snapshotStore: new LlmUsageSnapshotStore(join(tempDir, "llm-usage.json")),
        historyStore
      })
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await commands.show({ stats: true });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Records: 2"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage records: 1"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Empty usage records: 1"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Prompt-bearing records: 1"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Cache hit records: 1/1 (100.0%)"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Cache token rate: 32.0%"));
    expect(process.exitCode).toBe(0);
  });
});

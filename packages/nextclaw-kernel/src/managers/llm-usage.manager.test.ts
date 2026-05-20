import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import { LlmUsageStore } from "@kernel/stores/llm-usage.store.js";

function createUsageManager(): LlmUsageManager {
  const tempDir = mkdtempSync(join(tmpdir(), "nextclaw-kernel-llm-usage-"));
  return new LlmUsageManager({
    store: new LlmUsageStore({
      snapshotPath: join(tempDir, "llm-usage.json"),
      historyPath: join(tempDir, "llm-usage.jsonl"),
    }),
  });
}

describe("LlmUsageManager", () => {
  it("records snapshots and returns recent history newest first", () => {
    const manager = createUsageManager();

    manager.record({
      observedAt: "2026-04-11T01:00:00.000Z",
      source: "cli-agent",
      model: "gpt-test",
      usage: { prompt_tokens: 80, completion_tokens: 20, total_tokens: 100 },
    });
    manager.record({
      observedAt: "2026-04-11T02:00:00.000Z",
      source: "ui-ncp",
      model: "gpt-test-2",
      usage: { prompt_tokens: 200, completion_tokens: 40, total_tokens: 240 },
    });

    expect(manager.getSnapshot()?.observedAt).toBe("2026-04-11T02:00:00.000Z");
    expect(manager.getHistory(1)).toMatchObject([
      {
        observedAt: "2026-04-11T02:00:00.000Z",
        source: "ui-ncp",
      },
    ]);
  });

  it("aggregates usage stats in the kernel owner", () => {
    const manager = createUsageManager();

    manager.record({
      observedAt: "2026-04-11T01:00:00.000Z",
      source: "cli-agent",
      model: "gpt-test",
      usage: { prompt_tokens: 80, completion_tokens: 20, total_tokens: 100 },
    });
    manager.record({
      observedAt: "2026-04-11T02:00:00.000Z",
      source: "cli-agent",
      model: "gpt-test",
      usage: {
        prompt_tokens: 200,
        completion_tokens: 40,
        total_tokens: 240,
        prompt_tokens_details_cached_tokens: 64,
      },
    });

    expect(manager.getStats()).toMatchObject({
      totalRecords: 2,
      usageRecordCount: 2,
      promptTokenRecordCount: 2,
      totalPromptTokens: 280,
      totalCompletionTokens: 60,
      totalTokens: 340,
      totalCachedTokens: 64,
      cacheHitRecords: 1,
      cacheHitRate: 0.5,
      tokenCacheRate: 64 / 280,
      sources: [{ value: "cli-agent", count: 2 }],
      models: [{ value: "gpt-test", count: 2 }],
    });
  });
});

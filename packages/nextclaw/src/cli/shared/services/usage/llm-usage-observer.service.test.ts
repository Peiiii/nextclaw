import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { LLMProvider, ProviderManager, type LLMResponse, type LLMStreamEvent } from "@nextclaw/core";
import { LlmUsageObserver, ObservedProviderManager } from "./llm-usage-observer.service.js";
import { LlmUsageRecorder } from "./llm-usage-recorder.service.js";
import { LlmUsageHistoryStore } from "@/cli/shared/stores/llm-usage-history.store.js";
import { LlmUsageSnapshotStore } from "@/cli/shared/stores/llm-usage-snapshot.store.js";

class StaticUsageProvider extends LLMProvider {
  constructor(private readonly response: LLMResponse) {
    super("sk-test", "http://127.0.0.1:9/v1");
  }

  chat = async (): Promise<LLMResponse> => {
    return this.response;
  };

  chatStream = (): AsyncGenerator<LLMStreamEvent> => {
    const response = this.response;
    return (async function* (): AsyncGenerator<LLMStreamEvent> {
      yield { type: "done", response };
    })();
  };

  getDefaultModel = (): string => {
    return "gpt-test";
  };
}

describe("ObservedProviderManager", () => {
  it("writes cache metrics after chat responses", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "nextclaw-usage-observer-"));
    const snapshotStore = new LlmUsageSnapshotStore(join(tempDir, "llm-usage.json"));
    const historyStore = new LlmUsageHistoryStore(join(tempDir, "llm-usage.jsonl"));
    const manager = new ObservedProviderManager(
      new ProviderManager(new StaticUsageProvider({
        content: "ok",
        toolCalls: [],
        finishReason: "stop",
        usage: {
          prompt_tokens: 1200,
          completion_tokens: 50,
          total_tokens: 1250,
          prompt_tokens_details_cached_tokens: 1024
        }
      })),
      new LlmUsageObserver(new LlmUsageRecorder({ snapshotStore, historyStore }), "cli-agent")
    );

    await manager.chat({ messages: [{ role: "user", content: "hello" }], model: "gpt-test" });

    expect(snapshotStore.read()).toMatchObject({
      source: "cli-agent",
      model: "gpt-test",
      summary: { cachedTokens: 1024, cacheHit: true }
    });
    expect(historyStore.list()).toHaveLength(1);
    expect(historyStore.list()[0]).toMatchObject({
      source: "cli-agent",
      summary: { totalTokens: 1250, cachedTokens: 1024 }
    });
  });

  it("writes cache metrics after streaming done events", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "nextclaw-usage-observer-"));
    const snapshotStore = new LlmUsageSnapshotStore(join(tempDir, "llm-usage.json"));
    const historyStore = new LlmUsageHistoryStore(join(tempDir, "llm-usage.jsonl"));
    const manager = new ObservedProviderManager(
      new ProviderManager(new StaticUsageProvider({
        content: "ok",
        toolCalls: [],
        finishReason: "stop",
        usage: {
          input_tokens: 1000,
          output_tokens: 40,
          total_tokens: 1040,
          input_tokens_details_cached_tokens: 768
        }
      })),
      new LlmUsageObserver(new LlmUsageRecorder({ snapshotStore, historyStore }), "ui-ncp")
    );

    const events: LLMStreamEvent[] = [];
    for await (const event of manager.chatStream({ messages: [{ role: "user", content: "hello" }], model: "gpt-test" })) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(snapshotStore.read()).toMatchObject({
      source: "ui-ncp",
      summary: { cachedTokens: 768, cacheHit: true }
    });
    expect(historyStore.list()).toHaveLength(1);
    expect(historyStore.list()[0]).toMatchObject({
      source: "ui-ncp",
      summary: { promptTokens: 1000, completionTokens: 40, cachedTokens: 768 }
    });
  });

  it("skips empty usage payloads so they do not pollute usage history", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "nextclaw-usage-observer-"));
    const snapshotStore = new LlmUsageSnapshotStore(join(tempDir, "llm-usage.json"));
    const historyStore = new LlmUsageHistoryStore(join(tempDir, "llm-usage.jsonl"));
    const manager = new ObservedProviderManager(
      new ProviderManager(new StaticUsageProvider({
        content: "ok",
        toolCalls: [],
        finishReason: "stop",
        usage: {}
      })),
      new LlmUsageObserver(new LlmUsageRecorder({ snapshotStore, historyStore }), "ui-ncp")
    );

    await manager.chat({ messages: [{ role: "user", content: "hello" }], model: "default-model" });

    expect(snapshotStore.read()).toBeNull();
    expect(historyStore.list()).toHaveLength(0);
  });
});

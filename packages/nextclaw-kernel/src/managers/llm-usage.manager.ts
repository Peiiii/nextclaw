import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import {
  createLlmUsageRecord,
  hasLlmUsageTelemetry,
  type LlmUsageRecord,
} from "@kernel/types/llm-usage.types.js";
import { LlmUsageStore } from "@kernel/stores/llm-usage.store.js";

type ProviderChatParams = Parameters<LlmProviderRuntime["chat"]>[0];

export type LlmUsageStats = {
  totalRecords: number;
  usageRecordCount: number;
  emptyUsageRecordCount: number;
  promptTokenRecordCount: number;
  oldestObservedAt: string | null;
  latestObservedAt: string | null;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCachedTokens: number;
  cacheHitRecords: number;
  cacheHitRate: number;
  tokenCacheRate: number;
  sources: Array<{ value: string; count: number }>;
  models: Array<{ value: string; count: number }>;
};

export type LlmUsageManagerOptions = {
  store?: LlmUsageStore;
};

class ObservedLlmProviderRuntime implements LlmProviderRuntime {
  constructor(
    private readonly delegate: LlmProviderRuntime,
    private readonly manager: LlmUsageManager,
    private readonly source: string,
  ) {}

  get = (model?: string | null) => {
    return this.delegate.get(model);
  };

  chat = async (params: ProviderChatParams) => {
    const response = await this.delegate.chat(params);
    this.manager.record({
      source: this.source,
      model: params.model ?? null,
      usage: response.usage,
    });
    return response;
  };

  chatStream = async function* (
    this: ObservedLlmProviderRuntime,
    params: ProviderChatParams,
  ) {
    for await (const event of this.delegate.chatStream(params)) {
      if (event.type === "done") {
        this.manager.record({
          source: this.source,
          model: params.model ?? null,
          usage: event.response.usage,
        });
      }
      yield event;
    }
  };
}

export class LlmUsageManager {
  private readonly store: LlmUsageStore;

  constructor(options: LlmUsageManagerOptions = {}) {
    this.store = options.store ?? new LlmUsageStore();
  }

  get snapshotPath(): string {
    return this.store.snapshotPath;
  }

  get historyPath(): string {
    return this.store.historyPath;
  }

  observeProviderManager = (
    providerManager: LlmProviderRuntime,
    source: string,
  ): LlmProviderRuntime => {
    return new ObservedLlmProviderRuntime(providerManager, this, source);
  };

  record = (params: {
    observedAt?: string;
    source: string;
    model?: string | null;
    usage: Record<string, number>;
  }): LlmUsageRecord | null => {
    const record = createLlmUsageRecord(params);
    if (!hasLlmUsageTelemetry(record.usage)) {
      return null;
    }
    this.store.writeSnapshot(record);
    this.store.appendHistory(record);
    return record;
  };

  getSnapshot = (): LlmUsageRecord | null => {
    return this.store.readSnapshot();
  };

  getHistory = (limit?: string | number): LlmUsageRecord[] => {
    const records = this.store.listHistory();
    const resolvedLimit = this.resolveHistoryLimit(limit);
    return records.slice(-resolvedLimit).reverse();
  };

  resolveHistoryLimit = (value?: string | number): number => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.floor(parsed);
      }
    }
    return 10;
  };

  getStats = (): LlmUsageStats => {
    const records = this.store.listHistory();
    const sources = new Map<string, number>();
    const models = new Map<string, number>();
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalCachedTokens = 0;
    let cacheHitRecords = 0;
    let usageRecordCount = 0;
    let promptTokenRecordCount = 0;

    for (const record of records) {
      const hasUsage = Object.keys(record.usage).length > 0;
      if (hasUsage) {
        usageRecordCount += 1;
      }
      totalPromptTokens += record.summary.promptTokens;
      totalCompletionTokens += record.summary.completionTokens;
      totalTokens += record.summary.totalTokens;
      totalCachedTokens += record.summary.cachedTokens;
      if (record.summary.promptTokens > 0) {
        promptTokenRecordCount += 1;
      }
      if (record.summary.cacheHit) {
        cacheHitRecords += 1;
      }
      this.bumpCounter(sources, record.source);
      this.bumpCounter(models, record.model ?? "unknown");
    }

    return {
      totalRecords: records.length,
      usageRecordCount,
      emptyUsageRecordCount: records.length - usageRecordCount,
      promptTokenRecordCount,
      oldestObservedAt: records[0]?.observedAt ?? null,
      latestObservedAt: records.at(-1)?.observedAt ?? null,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalCachedTokens,
      cacheHitRecords,
      cacheHitRate: promptTokenRecordCount > 0 ? cacheHitRecords / promptTokenRecordCount : 0,
      tokenCacheRate: totalPromptTokens > 0 ? totalCachedTokens / totalPromptTokens : 0,
      sources: this.toSortedCounts(sources),
      models: this.toSortedCounts(models),
    };
  };

  private readonly bumpCounter = (map: Map<string, number>, value: string): void => {
    map.set(value, (map.get(value) ?? 0) + 1);
  };

  private readonly toSortedCounts = (map: Map<string, number>): Array<{ value: string; count: number }> => {
    return [...map.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        return left.value.localeCompare(right.value);
      });
  };
}

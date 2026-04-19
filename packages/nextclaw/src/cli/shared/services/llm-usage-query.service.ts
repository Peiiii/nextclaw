import { llmUsageHistoryStore, type LlmUsageHistoryStore } from "../stores/llm-usage-history.store.js";
import type { LlmUsageRecord } from "../stores/llm-usage-record.js";
import { llmUsageSnapshotStore, type LlmUsageSnapshotStore } from "../stores/llm-usage-snapshot.store.js";

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

export class LlmUsageQueryService {
  constructor(
    private readonly deps: {
      snapshotStore?: LlmUsageSnapshotStore;
      historyStore?: LlmUsageHistoryStore;
    } = {}
  ) {}

  get snapshotPath(): string {
    return this.snapshotStore.path;
  }

  get historyPath(): string {
    return this.historyStore.path;
  }

  readonly getSnapshot = () => {
    return this.snapshotStore.read();
  };

  readonly getHistory = (limit?: string | number): LlmUsageRecord[] => {
    const records = this.historyStore.list();
    const resolvedLimit = this.resolveLimit(limit);
    return records.slice(-resolvedLimit).reverse();
  };

  readonly getStats = (): LlmUsageStats => {
    const records = this.historyStore.list();
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

  private get snapshotStore(): LlmUsageSnapshotStore {
    return this.deps.snapshotStore ?? llmUsageSnapshotStore;
  }

  private get historyStore(): LlmUsageHistoryStore {
    return this.deps.historyStore ?? llmUsageHistoryStore;
  }

  private readonly resolveLimit = (value?: string | number): number => {
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

export const llmUsageQueryService = new LlmUsageQueryService();

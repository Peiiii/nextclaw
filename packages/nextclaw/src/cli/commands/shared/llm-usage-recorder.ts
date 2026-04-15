import { llmUsageHistoryStore, type LlmUsageHistoryStore } from "../../runtime-state/llm-usage-history.store.js";
import { llmUsageRecordFactory, type LlmUsageRecord, type LlmUsageRecordFactory } from "../../runtime-state/llm-usage-record.js";
import { llmUsageSnapshotStore, type LlmUsageSnapshotStore } from "../../runtime-state/llm-usage-snapshot.store.js";

export class LlmUsageRecorder {
  constructor(
    private readonly deps: {
      snapshotStore?: LlmUsageSnapshotStore;
      historyStore?: LlmUsageHistoryStore;
      recordFactory?: LlmUsageRecordFactory;
    } = {}
  ) {}

  readonly record = (params: {
    observedAt?: string;
    source: string;
    model?: string | null;
    usage: Record<string, number>;
  }): LlmUsageRecord | null => {
    const record = this.recordFactory.create(params);
    if (!this.recordFactory.hasTelemetry(record.usage)) {
      return null;
    }
    this.snapshotStore.write(record);
    this.historyStore.append(record);
    return record;
  };

  private get snapshotStore(): LlmUsageSnapshotStore {
    return this.deps.snapshotStore ?? llmUsageSnapshotStore;
  }

  private get historyStore(): LlmUsageHistoryStore {
    return this.deps.historyStore ?? llmUsageHistoryStore;
  }

  private get recordFactory(): LlmUsageRecordFactory {
    return this.deps.recordFactory ?? llmUsageRecordFactory;
  }
}

export const llmUsageRecorder = new LlmUsageRecorder();

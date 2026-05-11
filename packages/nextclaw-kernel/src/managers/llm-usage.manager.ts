import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import {
  createLlmUsageRecord,
  hasLlmUsageTelemetry,
  type LlmUsageRecord,
} from "@kernel/types/llm-usage.types.js";
import { LlmUsageStore } from "@kernel/stores/llm-usage.store.js";

type ProviderChatParams = Parameters<LlmProviderRuntime["chat"]>[0];

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
}

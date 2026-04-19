import type { ProviderManager } from "@nextclaw/core";
import { ProviderManager as ProviderManagerBase } from "@nextclaw/core";
import type { LlmUsageRecord } from "../stores/llm-usage-record.js";
import type { LlmUsageRecorder } from "./llm-usage-recorder.service.js";

type ProviderChatParams = Parameters<ProviderManager["chat"]>[0];
type ProviderSetParam = Parameters<ProviderManager["set"]>[0];
type ProviderConfigParam = Parameters<ProviderManager["setConfig"]>[0];

export class LlmUsageObserver {
  constructor(
    private readonly recorder: LlmUsageRecorder,
    private readonly source: string
  ) {}

  readonly observe = (params: {
    model?: string | null;
    usage: Record<string, number>;
  }): LlmUsageRecord | null => {
    return this.recorder.record({
      source: this.source,
      model: params.model ?? null,
      usage: params.usage,
    });
  };
}

export class ObservedProviderManager extends ProviderManagerBase {
  constructor(
    private readonly delegate: ProviderManager,
    private readonly observer: LlmUsageObserver
  ) {
    super(delegate.get(null));
  }

  override get(model?: string | null) {
    return this.delegate.get(model);
  }

  override set(next: ProviderSetParam): void {
    this.delegate.set(next);
  }

  override setConfig(nextConfig: ProviderConfigParam): void {
    this.delegate.setConfig(nextConfig);
  }

  override async chat(params: ProviderChatParams) {
    const response = await this.delegate.chat(params);
    this.observer.observe({ model: params.model ?? null, usage: response.usage });
    return response;
  }

  override async *chatStream(params: ProviderChatParams) {
    for await (const event of this.delegate.chatStream(params)) {
      if (event.type === "done") {
        this.observer.observe({ model: params.model ?? null, usage: event.response.usage });
      }
      yield event;
    }
  }
}

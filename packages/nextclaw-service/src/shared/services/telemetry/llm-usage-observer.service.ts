import type { LlmProviderRuntime } from "@nextclaw/kernel";
import type { LlmUsageRecord } from "@nextclaw-service/shared/stores/llm-usage-record.js";
import type { LlmUsageRecorder } from "./llm-usage-recorder.service.js";

type ProviderChatParams = Parameters<LlmProviderRuntime["chat"]>[0];

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

export class ObservedProviderManager implements LlmProviderRuntime {
  constructor(
    private readonly delegate: LlmProviderRuntime,
    private readonly observer: LlmUsageObserver
  ) {}

  readonly get = (model?: string | null) => {
    return this.delegate.get(model);
  };

  readonly chat = async (params: ProviderChatParams) => {
    const response = await this.delegate.chat(params);
    this.observer.observe({ model: params.model ?? null, usage: response.usage });
    return response;
  };

  readonly chatStream = async function* (
    this: ObservedProviderManager,
    params: ProviderChatParams
  ) {
    for await (const event of this.delegate.chatStream(params)) {
      if (event.type === "done") {
        this.observer.observe({ model: params.model ?? null, usage: event.response.usage });
      }
      yield event;
    }
  };
}

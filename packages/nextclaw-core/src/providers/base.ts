export type ToolCallRequest = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type LLMResponse = {
  content: string | null;
  toolCalls: ToolCallRequest[];
  finishReason: string;
  usage: Record<string, number>;
  reasoningContent?: string | null;
};

export type LLMStreamDelta = {
  type: "delta";
  delta: string;
};

export type LLMStreamDone = {
  type: "done";
  response: LLMResponse;
};

export type LLMStreamEvent = LLMStreamDelta | LLMStreamDone;

export abstract class LLMProvider {
  protected apiKey?: string | null;
  protected apiBase?: string | null;

  constructor(apiKey?: string | null, apiBase?: string | null) {
    this.apiKey = apiKey ?? undefined;
    this.apiBase = apiBase ?? undefined;
  }

  abstract chat(params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<LLMResponse>;

  async *chatStream(params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<LLMStreamEvent> {
    const response = await this.chat(params);
    yield { type: "done", response };
  }

  abstract getDefaultModel(): string;
}

import type { LLMProvider, LLMResponse, LLMStreamEvent } from "./providers/base.js";

export * from "./providers/base.js";
export * from "./features/anthropic/index.js";
export * from "./providers/litellm.provider.js";
export * from "./providers/registry.js";

export type ProviderChatParams = Parameters<LLMProvider["chat"]>[0];

export type ProviderManager = {
  get: (model?: string | null) => LLMProvider;
  chat: (params: ProviderChatParams) => Promise<LLMResponse>;
  chatStream: (params: ProviderChatParams) => AsyncGenerator<LLMStreamEvent>;
};

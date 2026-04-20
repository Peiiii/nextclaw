import type { AgentRecord } from "@/types/agent.types.js";
import type { ContextRecord } from "@/types/context.types.js";
import type { LlmProviderId } from "@/types/entity-ids.types.js";
import type { LlmProviderRecord } from "@/types/llm-provider.types.js";

export abstract class LlmProviderManager {
  abstract listProviders(): LlmProviderRecord[];
  abstract getProvider(providerId: LlmProviderId): LlmProviderRecord | null;
  abstract requireProvider(providerId: LlmProviderId): LlmProviderRecord;
  abstract saveProvider(provider: LlmProviderRecord): void;
  abstract enableProvider(providerId: LlmProviderId): void;
  abstract disableProvider(providerId: LlmProviderId): void;
  abstract selectProvider(input: {
    agent: AgentRecord;
    context: ContextRecord;
  }): LlmProviderRecord;
}

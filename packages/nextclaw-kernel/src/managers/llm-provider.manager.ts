import type { AgentRecord } from "@/types/agent.types.js";
import type { ContextRecord } from "@/types/context.types.js";
import type { LlmProviderId } from "@/types/entity-ids.types.js";
import type { LlmProviderRecord } from "@/types/llm-provider.types.js";

export class LlmProviderManager {
  readonly listProviders = () => {
    throw new Error("LlmProviderManager.listProviders is not implemented.");
  };

  readonly getProvider = (providerId: LlmProviderId) => {
    void providerId;
    throw new Error("LlmProviderManager.getProvider is not implemented.");
  };

  readonly requireProvider = (providerId: LlmProviderId) => {
    void providerId;
    throw new Error("LlmProviderManager.requireProvider is not implemented.");
  };

  readonly saveProvider = (provider: LlmProviderRecord) => {
    void provider;
    throw new Error("LlmProviderManager.saveProvider is not implemented.");
  };

  readonly enableProvider = (providerId: LlmProviderId) => {
    void providerId;
    throw new Error("LlmProviderManager.enableProvider is not implemented.");
  };

  readonly disableProvider = (providerId: LlmProviderId) => {
    void providerId;
    throw new Error("LlmProviderManager.disableProvider is not implemented.");
  };

  readonly selectProvider = (input: {
    agent: AgentRecord;
    context: ContextRecord;
  }) => {
    void input;
    throw new Error("LlmProviderManager.selectProvider is not implemented.");
  };
}

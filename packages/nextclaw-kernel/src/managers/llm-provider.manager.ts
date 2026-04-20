import type { AgentRecord } from "@/types/agent.types.js";
import type { ContextRecord } from "@/types/context.types.js";
import type { LlmProviderId } from "@/types/entity-ids.types.js";
import type { LlmProviderRecord } from "@/types/llm-provider.types.js";

export class LlmProviderManager {
  readonly listProviders = () => {
    // TODO(kernel): return the current provider registry snapshot.
    throw new Error("LlmProviderManager.listProviders is not implemented.");
  };

  readonly getProvider = (providerId: LlmProviderId) => {
    // TODO(kernel): look up a provider by id.
    void providerId;
    throw new Error("LlmProviderManager.getProvider is not implemented.");
  };

  readonly requireProvider = (providerId: LlmProviderId) => {
    // TODO(kernel): resolve a provider and throw a domain error when missing.
    void providerId;
    throw new Error("LlmProviderManager.requireProvider is not implemented.");
  };

  readonly saveProvider = (provider: LlmProviderRecord) => {
    // TODO(kernel): persist provider state.
    void provider;
    throw new Error("LlmProviderManager.saveProvider is not implemented.");
  };

  readonly enableProvider = (providerId: LlmProviderId) => {
    // TODO(kernel): enable provider availability.
    void providerId;
    throw new Error("LlmProviderManager.enableProvider is not implemented.");
  };

  readonly disableProvider = (providerId: LlmProviderId) => {
    // TODO(kernel): disable provider availability.
    void providerId;
    throw new Error("LlmProviderManager.disableProvider is not implemented.");
  };

  readonly selectProvider = (input: {
    agent: AgentRecord;
    context: ContextRecord;
  }) => {
    // TODO(kernel): resolve the effective provider for a run.
    void input;
    throw new Error("LlmProviderManager.selectProvider is not implemented.");
  };
}

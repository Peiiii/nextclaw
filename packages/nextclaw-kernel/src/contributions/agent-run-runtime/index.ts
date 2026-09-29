import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { BuiltinNarpRuntimeProviderService } from "@kernel/features/narp-runtime/index.js";
import {
  resolveAgentRuntimeEntries,
  type AgentRuntimeProviderRegistration,
} from "@kernel/features/runtime-registry/index.js";
import { Contribution } from "@nextclaw/shared";
import type { Config } from "@nextclaw/core";

export class AgentRunRuntimeContribution extends Contribution {
  constructor(private readonly kernel: NextclawKernel) {
    super();
  }

  protected setup = (): void => {
    this.effect(() =>
      this.kernel.requestContextTailManager.register({
        provide: async ({ sessionId, signal }) => {
          const tail = await this.kernel.observations.buildContextTail({
            sessionId,
            signal,
          });
          return tail
            ? [
                {
                  source: "observation",
                  trust: "untrusted" as const,
                  content: [...tail.entries],
                },
              ]
            : [];
        },
      }),
    );
    this.effect(() => {
      this.applyRuntimeConfig(this.kernel.configManager.loadConfig());
      return this.kernel.configManager.installRuntimeHooks({
        applyAgentRuntimeConfig: this.applyRuntimeConfig,
      });
    });
    for (const provider of new BuiltinNarpRuntimeProviderService(
      this.kernel.configManager,
    ).createProviders()) {
      this.effect(() => this.registerNarpRuntime(provider));
    }
  };

  private readonly applyRuntimeConfig = (config: Config): void => {
    const { entries } = resolveAgentRuntimeEntries({
      config,
    });
    this.kernel.agentRuntimeManager.applyEntries(entries);
  };

  private registerNarpRuntime = (
    provider: AgentRuntimeProviderRegistration,
  ): (() => Promise<void>) =>
    this.kernel.agentRuntimeManager.registerProvider(provider, {
      resolveAssetContentPath: this.kernel.assetStore.resolveContentPath,
    });
}

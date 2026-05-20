import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { BuiltinNarpRuntimeProviderService } from "@kernel/features/narp-runtime/index.js";
import { NativeAgentRuntimeFactory } from "@kernel/features/native-runtime/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";

export class AgentRuntimeContribution implements KernelContribution {
  private cleanups: Array<() => void> = [];

  constructor(private readonly kernel: NextclawKernel) {}

  start = (): void => {
    if (this.cleanups.length > 0) {
      return;
    }
    const nativeRuntimeFactory = new NativeAgentRuntimeFactory({
      providerManager: this.kernel.llmProviders,
      sessions: this.kernel.sessions,
      configManager: this.kernel.configManager,
      llmUsage: this.kernel.llmUsage,
      onSessionUpdated: this.kernel.publishSessionUpdated,
      assetStore: this.kernel.assetStore,
      updateToolCallResult: this.kernel.agentRuntimeManager.updateToolCallResult,
      toolManager: this.kernel.toolManager,
    });
    const builtinNarpRuntimeProviders = new BuiltinNarpRuntimeProviderService(
      this.kernel.configManager.loadConfig,
    ).createProviders();
    const nativeRegistration = this.kernel.agentRuntimeManager.registerRuntimeProvider({
      kind: "native",
      label: "Native",
      createRuntime: nativeRuntimeFactory.create,
    });
    this.cleanups = [
      () => nativeRegistration.dispose(),
      ...builtinNarpRuntimeProviders.map((provider) => {
        const registration = this.kernel.agentRuntimeManager.registerRuntimeProvider(provider);
        return () => registration.dispose();
      }),
    ];
  };

  dispose = (): void => {
    for (const cleanup of this.cleanups) {
      cleanup();
    }
    this.cleanups = [];
  };
}

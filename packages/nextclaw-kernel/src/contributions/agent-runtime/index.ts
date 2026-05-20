import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { BuiltinNarpRuntimeRegistrationService } from "@kernel/features/narp-runtime/index.js";
import { NativeAgentRuntimeFactory } from "@kernel/features/native-runtime/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import type { Disposable } from "@nextclaw/core";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";

type RuntimeToolResolver = NonNullable<RuntimeFactoryParams["resolveTools"]>;

export class AgentRuntimeContribution implements KernelContribution {
  private registrations: Disposable[] = [];

  constructor(private readonly kernel: NextclawKernel) {}

  start = (): void => {
    if (this.registrations.length > 0) {
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
    const resolveTools: RuntimeToolResolver = nativeRuntimeFactory.resolveOpenAiToolsForRuntime;
    const builtinNarpRegistrationService = new BuiltinNarpRuntimeRegistrationService(
      this.kernel.configManager.loadConfig,
      { resolveTools },
    );
    this.registrations = [
      this.kernel.agentRuntimeManager.registerRuntimeProvider({
        kind: "native",
        label: "Native",
        createRuntime: nativeRuntimeFactory.create,
      }),
      ...builtinNarpRegistrationService.registerInto(this.kernel.agentRuntimeManager),
    ];
  };

  dispose = (): void => {
    for (const registration of this.registrations) {
      registration.dispose();
    }
    this.registrations = [];
  };
}

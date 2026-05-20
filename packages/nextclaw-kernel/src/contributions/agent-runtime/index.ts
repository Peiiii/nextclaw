import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import {
  BuiltinNarpRuntimeRegistrationService,
  NARP_HTTP_RUNTIME_KIND,
  NARP_STDIO_RUNTIME_KIND,
} from "@kernel/features/narp-runtime/index.js";
import { NativeAgentRuntimeFactory } from "@kernel/features/native-runtime/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { DisposableStore, type Disposable } from "@nextclaw/core";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";

const RESERVED_BUILTIN_RUNTIME_KINDS = new Set([
  NARP_HTTP_RUNTIME_KIND,
  NARP_STDIO_RUNTIME_KIND,
]);
type RuntimeToolResolver = NonNullable<RuntimeFactoryParams["resolveTools"]>;

export class AgentRuntimeContribution implements KernelContribution {
  private registrations: Disposable[] = [];
  private pluginRuntimeProviderRegistrations = new DisposableStore();
  private resolveTools: RuntimeToolResolver | null = null;

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
    this.resolveTools = nativeRuntimeFactory.resolveOpenAiToolsForRuntime;
    const builtinNarpRegistrationService = new BuiltinNarpRuntimeRegistrationService(
      this.kernel.configManager.loadConfig,
      { resolveTools: this.resolveTools },
    );
    this.registrations = [
      this.kernel.agentRuntimeManager.registerRuntimeProvider({
        kind: "native",
        label: "Native",
        createRuntime: nativeRuntimeFactory.create,
      }),
      ...builtinNarpRegistrationService.registerInto(this.kernel.agentRuntimeManager),
      this.kernel.extensions.onDidChange(this.syncPluginRuntimeProviders),
    ];
    this.syncPluginRuntimeProviders();
  };

  dispose = (): void => {
    for (const registration of this.registrations) {
      registration.dispose();
    }
    this.registrations = [];
    this.resolveTools = null;
    this.pluginRuntimeProviderRegistrations.dispose();
    this.pluginRuntimeProviderRegistrations = new DisposableStore();
  };

  private syncPluginRuntimeProviders = (): void => {
    this.pluginRuntimeProviderRegistrations.dispose();
    this.pluginRuntimeProviderRegistrations = new DisposableStore();
    for (const registration of this.kernel.extensions.getExtensionRegistry().ncpAgentRuntimes) {
      if (RESERVED_BUILTIN_RUNTIME_KINDS.has(registration.kind.trim().toLowerCase())) {
        continue;
      }
      const createRuntimeForEntry = registration.createRuntimeForEntry;
      const resolveTools = this.resolveTools ?? undefined;
      this.pluginRuntimeProviderRegistrations.add(this.kernel.agentRuntimeManager.registerRuntimeProvider({
        kind: registration.kind,
        label: registration.label,
        createRuntime: (runtimeParams) => registration.createRuntime({
          ...runtimeParams,
          resolveTools,
        }),
        createRuntimeForEntry: createRuntimeForEntry
          ? ({ entry, runtimeParams }) =>
              createRuntimeForEntry({
                entry,
                runtimeParams: {
                  ...runtimeParams,
                  resolveTools,
                  sessionMetadata: {
                    ...runtimeParams.sessionMetadata,
                    runtime_type: entry.type,
                  },
                },
              })
          : undefined,
        describeSessionType: registration.describeSessionType,
        describeSessionTypeForEntry: registration.describeSessionTypeForEntry,
      }));
    }
  };
}

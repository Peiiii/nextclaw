import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { DEFAULT_AGENT_RUNTIME_ENTRY_ID } from "@kernel/configs/agent-runtime.config.js";
import { BuiltinNarpRuntimeProviderService } from "@kernel/features/narp-runtime/index.js";
import { ProviderManagerNcpLLMApi } from "@kernel/features/native-runtime/index.js";
import {
  resolveAgentRuntimeEntries,
  type AgentRuntimeProviderRegistration,
} from "@kernel/features/runtime-registry/index.js";
import { AgentRunMessageProjector } from "@kernel/services/agent-run-message-projector.service.js";
import { AgentRunModelInputBudgeter } from "@kernel/services/agent-run-model-input-budgeter.service.js";
import { AgentRunModelInputBuilder } from "@kernel/services/agent-run-model-input-builder.service.js";
import { NcpAgentRuntimeWrapper } from "@kernel/services/ncp-agent-runtime-wrapper.service.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import type { Config } from "@nextclaw/core";
import { DefaultNcpAgentRuntime } from "@nextclaw/ncp-agent-runtime-next";

export class AgentRunRuntimeContribution implements KernelContribution {
  private readonly cleanups: Array<() => Promise<void>> = [];
  private readonly modelInputBuilder: AgentRunModelInputBuilder;

  constructor(private readonly kernel: NextclawKernel) {
    this.modelInputBuilder = new AgentRunModelInputBuilder(
      new AgentRunMessageProjector(),
      new AgentRunModelInputBudgeter(kernel.configManager),
      kernel.assetStore,
    );
  }

  start = (): void => {
    if (this.cleanups.length > 0) {
      return;
    }
    this.applyRuntimeConfig(this.kernel.configManager.loadConfig());
    this.kernel.configManager.installRuntimeHooks({
      applyAgentRuntimeConfig: this.applyRuntimeConfig,
    });
    this.cleanups.push(this.registerNativeRuntime());
    for (const provider of new BuiltinNarpRuntimeProviderService(
      this.kernel.configManager,
    ).createProviders()) {
      this.cleanups.push(this.registerNarpRuntime(provider));
    }
  };

  dispose = async (): Promise<void> => {
    while (this.cleanups.length > 0) {
      await this.cleanups.pop()?.();
    }
  };

  private readonly applyRuntimeConfig = (config: Config): void => {
    const { entries } = resolveAgentRuntimeEntries({
      config,
    });
    this.kernel.agentRuntimeManager.applyEntries(entries);
  };

  private registerNativeRuntime = (): (() => Promise<void>) =>
    this.kernel.agentRuntimeManager.register({
      kind: DEFAULT_AGENT_RUNTIME_ENTRY_ID,
      label: "Native",
      defaultReuseScope: "global",
      createRuntime: () =>
        new DefaultNcpAgentRuntime({
          llmApi: new ProviderManagerNcpLLMApi(this.kernel.llmProviders),
          modelInputBuilder: this.modelInputBuilder,
          runPreflight: async ({ spec, sessionRun }) => {
            const session = await this.kernel.sessionManager.getAgentRunSession(sessionRun.sessionId);
            return await this.kernel.contextCompactionManager.runPreflight({
              agentId: spec.agentId,
              messages: sessionRun.getSnapshot().messages,
              metadata: session.metadata,
              sessionId: sessionRun.sessionId,
            });
          },
        }),
    });

  private registerNarpRuntime = (
    provider: AgentRuntimeProviderRegistration,
  ): (() => Promise<void>) =>
    this.kernel.agentRuntimeManager.register({
      kind: provider.kind,
      label: provider.label,
      defaultReuseScope: "session",
      describeSessionTypeForEntry: provider.describeSessionTypeForEntry,
      createRuntime: ({ entry, session }) => {
        if (!provider.createRuntimeForEntry) {
          throw new Error(`Agent runtime provider does not support entries: ${provider.kind}`);
        }
        return new NcpAgentRuntimeWrapper({
          session,
          createRuntime: ({ resolveTools, stateManager }) =>
            provider.createRuntimeForEntry!({
              entry,
              runtimeParams: {
                sessionId: session.sessionId,
                ...(session.agentId ? { agentId: session.agentId } : {}),
                resolveAssetContentPath: (assetUri) =>
                  this.kernel.assetStore.resolveContentPath(assetUri),
                resolveTools,
                sessionMetadata: session.metadata,
                stateManager,
              },
            }),
        });
      },
    });
}

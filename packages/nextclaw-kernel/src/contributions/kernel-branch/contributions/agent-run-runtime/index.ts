import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelBranch } from "@kernel/contributions/kernel-branch/index.js";
import { DEFAULT_AGENT_RUNTIME_ENTRY_ID } from "@kernel/configs/agent-runtime.config.js";
import {
  AgentRunMessageProjector,
  AgentRunModelInputBudgeter,
  AgentRunModelInputBuilder,
  NcpAgentRuntimeWrapper,
} from "@kernel/features/agent-run/index.js";
import {
  BuiltinNarpRuntimeProviderService,
  NARP_STDIO_RUNTIME_KIND,
} from "@kernel/features/narp-runtime/index.js";
import { ProviderManagerNcpLLMApi } from "@kernel/features/native-runtime/index.js";
import {
  resolveAgentRuntimeEntries,
  type AgentRuntimeProviderRegistration,
} from "@kernel/features/runtime-registry/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { DefaultNcpAgentRuntime } from "@nextclaw/ncp-agent-runtime-next";

export class AgentRunRuntimeContribution implements KernelContribution {
  private readonly cleanups: Array<() => Promise<void>> = [];
  private readonly modelInputBuilder: AgentRunModelInputBuilder;

  constructor(
    private readonly kernel: NextclawKernel,
    private readonly branch: KernelBranch,
  ) {
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
    const { entries } = resolveAgentRuntimeEntries({
      config: this.kernel.configManager.loadConfig(),
    });
    this.branch.agentRuntimeManager.applyEntries(entries);
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

  private registerNativeRuntime = (): (() => Promise<void>) =>
    this.branch.agentRuntimeManager.register({
      kind: DEFAULT_AGENT_RUNTIME_ENTRY_ID,
      label: "Native",
      defaultReuseScope: "global",
      createRuntime: () =>
        new DefaultNcpAgentRuntime({
          llmApi: new ProviderManagerNcpLLMApi(this.kernel.llmProviders),
          modelInputBuilder: this.modelInputBuilder,
          runPreflight: async ({ spec, sessionRun }) => {
            const session = await this.branch.sessionRepository.getSession(sessionRun.sessionId);
            return await this.branch.contextCompactionManager.runPreflight({
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
    this.branch.agentRuntimeManager.register({
      kind: provider.kind,
      label: provider.label,
      defaultReuseScope: provider.kind === NARP_STDIO_RUNTIME_KIND ? "session" : "session",
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

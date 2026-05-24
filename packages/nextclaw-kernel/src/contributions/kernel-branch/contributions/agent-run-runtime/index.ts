import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelBranch } from "@kernel/contributions/kernel-branch/index.js";
import { DEFAULT_AGENT_RUNTIME_ENTRY_ID } from "@kernel/configs/agent-runtime.config.js";
import {
  AgentRunMessageProjector,
  AgentRunModelInputBudgeter,
  AgentRunModelInputBuilder,
} from "@kernel/features/agent-run/index.js";
import { ProviderManagerNcpLLMApi } from "@kernel/features/native-runtime/index.js";
import { resolveAgentRuntimeEntries } from "@kernel/features/runtime-registry/index.js";
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
    for (const entry of entries) {
      if (entry.enabled === false || entry.type !== DEFAULT_AGENT_RUNTIME_ENTRY_ID) {
        continue;
      }
      this.cleanups.push(this.registerNativeRuntime(entry.id));
    }
  };

  dispose = async (): Promise<void> => {
    while (this.cleanups.length > 0) {
      await this.cleanups.pop()?.();
    }
  };

  private registerNativeRuntime = (runtimeId: string): (() => Promise<void>) =>
    this.branch.agentRuntimeManager.register({
      id: runtimeId,
      label: "Native",
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
}

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
import { Contribution } from "@nextclaw/shared";
import type { Config } from "@nextclaw/core";
import {
  DefaultNcpAgentRuntime,
  type AgentRunPreflight,
} from "@nextclaw/ncp-agent-runtime-next";

export class AgentRunRuntimeContribution extends Contribution {
  private readonly modelInputBuilder: AgentRunModelInputBuilder;

  constructor(private readonly kernel: NextclawKernel) {
    super();
    this.modelInputBuilder = new AgentRunModelInputBuilder(
      new AgentRunMessageProjector(),
      new AgentRunModelInputBudgeter(kernel.agents),
      kernel.assetStore,
      kernel.observations,
    );
  }

  protected setup = (): void => {
    this.effect(() => {
      this.applyRuntimeConfig(this.kernel.configManager.loadConfig());
      return this.kernel.configManager.installRuntimeHooks({
        applyAgentRuntimeConfig: this.applyRuntimeConfig,
      });
    });
    this.effect(this.registerNativeRuntime);
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

  private registerNativeRuntime = (): (() => Promise<void>) =>
    this.kernel.agentRuntimeManager.register({
      kind: DEFAULT_AGENT_RUNTIME_ENTRY_ID,
      label: "Native",
      defaultReuseScope: "global",
      createRuntime: ({ entry }) => {
        const runtime = new DefaultNcpAgentRuntime({
          llmApi: new ProviderManagerNcpLLMApi(this.kernel.llmProviders),
          modelInputBuilder: this.modelInputBuilder,
          runPreflight: this.runNativePreflight,
        });
        return {
          capabilities: { nextStepInput: true },
          run: (spec, options) =>
            runtime.run(spec, {
              ...options,
              contextBlocks:
                entry.injectNextclawContext === false
                  ? []
                  : options.contextBlocks,
            }),
          compactContext: async ({ session, sessionRun }) => {
            const model = session.model ?? this.kernel.configManager.getDefaultModel();
            const events = await this.kernel.contextCompactionManager.runManual({
              agentId: session.agentId ?? this.kernel.agents.getDefaultAgentId(),
              contextBlocks: [],
              messages: sessionRun.getSnapshot().messages,
              metadata: session.metadata,
              model,
              sessionId: session.sessionId,
            });
            return {
              events,
              performed: events.length > 0,
              supported: true,
            };
          },
        };
      },
    });

  private readonly runNativePreflight: AgentRunPreflight = async function* (
    this: AgentRunRuntimeContribution,
    input: Parameters<AgentRunPreflight>[0],
  ) {
    const { contextBlocks, phase, signal, spec, sessionRun, tools } = input;
    const session = await this.kernel.sessionManager.getAgentRunSession(sessionRun.sessionId);
    yield* this.kernel.contextCompactionManager.runPreflight({
      agentId: spec.agentId,
      contextBlocks,
      messages: sessionRun.getSnapshot().messages,
      metadata: session.metadata,
      model: spec.model,
      phase,
      signal,
      sessionId: sessionRun.sessionId,
      tools,
    });
  }.bind(this);

  private registerNarpRuntime = (
    provider: AgentRuntimeProviderRegistration,
  ): (() => Promise<void>) =>
    this.kernel.agentRuntimeManager.registerProvider(provider, {
      resolveAssetContentPath: this.kernel.assetStore.resolveContentPath,
    });
}

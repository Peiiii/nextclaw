import { DefaultNcpAgentRuntime, type AgentRunPreflight } from "@nextclaw/ncp-agent-runtime-next";
import type { NcpLLMApi } from "@nextclaw/ncp";
import type { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import { DEFAULT_AGENT_RUNTIME_ENTRY_ID } from "@kernel/configs/agent-runtime.config.js";
import type { AgentRuntimeRegistration } from "@kernel/managers/agent-runtime.manager.js";
import type { AgentRunContextCompactionManager } from "@kernel/managers/agent-run-context-compaction.manager.js";
import type { AgentRunSessionHost } from "@kernel/types/agent-run-host.types.js";
import type { RequestContextTailManager } from "@kernel/managers/request-context-tail.manager.js";
import { AgentRunMessageProjector } from "@kernel/services/agent-run-message-projector.service.js";
import { AgentRunModelInputBudgeter, type AgentModelInputBudgetProfileResolver } from "@kernel/services/agent-run-model-input-budgeter.service.js";
import { AgentRunModelInputBuilder } from "@kernel/services/agent-run-model-input-builder.service.js";

export type NativeAgentRuntimeResources = {
  models: NcpLLMApi;
  agents: AgentModelInputBudgetProfileResolver & { getDefaultAgentId(): string };
  config: { getDefaultModel(): string };
  sessions: Pick<AgentRunSessionHost, "getAgentRunSession">;
  compaction: Pick<AgentRunContextCompactionManager, "runPreflight" | "runManual">;
  assets?: LocalAssetStore | null;
  contextTail?: Pick<RequestContextTailManager, "build"> | null;
};

/** One native runtime composition for every Kernel platform. */
export function createNativeAgentRuntimeRegistration(resources: NativeAgentRuntimeResources): AgentRuntimeRegistration {
  const modelInputBuilder = new AgentRunModelInputBuilder(
    new AgentRunMessageProjector(), new AgentRunModelInputBudgeter(resources.agents),
    resources.assets ?? null, resources.contextTail ?? null,
  );
  const runPreflight: AgentRunPreflight = async function* (input) {
    const { contextBlocks, phase, signal, spec, sessionRun, tools } = input;
    const session = await resources.sessions.getAgentRunSession(sessionRun.sessionId);
    yield* resources.compaction.runPreflight({
      agentId: spec.agentId, contextBlocks, messages: sessionRun.getSnapshot().messages,
      metadata: session.metadata, model: spec.model, phase, signal,
      sessionId: sessionRun.sessionId, tools,
    });
  };
  return {
    kind: DEFAULT_AGENT_RUNTIME_ENTRY_ID,
    label: "Native",
    defaultReuseScope: "global",
    createRuntime: ({ entry }) => {
      const runtime = new DefaultNcpAgentRuntime({ llmApi: resources.models, modelInputBuilder, runPreflight });
      return {
        capabilities: { nextStepInput: true },
        run: (spec, options) => runtime.run(spec, {
          ...options, contextBlocks: entry.injectNextclawContext === false ? [] : options.contextBlocks,
        }),
        compactContext: async ({ session, sessionRun }) => {
          const events = await resources.compaction.runManual({
            agentId: session.agentId ?? resources.agents.getDefaultAgentId(), contextBlocks: [],
            messages: sessionRun.getSnapshot().messages, metadata: session.metadata,
            model: session.model ?? resources.config.getDefaultModel(), sessionId: session.sessionId,
          });
          return { events, performed: events.length > 0, supported: true };
        },
      };
    },
  };
}

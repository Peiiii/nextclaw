import {
  type Config,
  type ContextWindowSnapshot,
} from "@nextclaw/core";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import { DefaultNcpAgentRuntime, type LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import {
  type NcpAgentRunInput,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  NcpEventType,
  type NcpMessage,
  readAssistantReasoningNormalizationMode,
  readAssistantReasoningNormalizationModeFromMetadata,
  type NcpAssistantReasoningNormalizationMode,
  writeAssistantReasoningNormalizationModeToMetadata,
} from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import { type LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import type {
  ToolManager,
  UpdateToolCallResult,
} from "@kernel/managers/tool.manager.js";
import { ContextCompactionManager } from "@kernel/features/context-compaction/index.js";
import { NextclawNcpContextBuilder } from "./nextclaw-ncp-context-builder.service.js";
import { ProviderManagerNcpLLMApi } from "./provider-manager-ncp-llm-api.service.js";

export type NativeRuntimeFactory = (runtimeParams: RuntimeFactoryParams) => NcpAgentRuntime;

export type NativeAgentRuntimeFactoryOptions = {
  providerManager: LlmProviderRuntime;
  configManager: { loadConfig: () => Config };
  llmUsage: LlmUsageManager;
  onSessionUpdated: (sessionKey: string) => void;
  assetStore: LocalAssetStore;
  updateToolCallResult: UpdateToolCallResult;
  toolManager: ToolManager;
};

function createContextWindowUpdatedEvent(params: {
  contextWindow: ContextWindowSnapshot;
  sessionId: string;
}): NcpEndpointEvent {
  return {
    type: NcpEventType.ContextWindowUpdated,
    payload: {
      sessionId: params.sessionId,
      contextWindow: params.contextWindow,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveNativeReasoningNormalizationMode(params: {
  config: Config;
  sessionMetadata: Record<string, unknown>;
}): NcpAssistantReasoningNormalizationMode {
  const runtimeEntry =
    params.config.agents.runtimes.entries.native?.config ??
    params.config.ui.ncp.runtimes.native;
  const runtimeMetadata = isRecord(runtimeEntry) ? runtimeEntry : {};

  return (
    readAssistantReasoningNormalizationModeFromMetadata(params.sessionMetadata) ??
    readAssistantReasoningNormalizationMode(runtimeMetadata.reasoningNormalization) ??
    readAssistantReasoningNormalizationMode(runtimeMetadata.reasoning_normalization) ??
    readAssistantReasoningNormalizationMode(runtimeMetadata.reasoningNormalizationMode) ??
    readAssistantReasoningNormalizationMode(runtimeMetadata.reasoning_normalization_mode) ??
    "think-tags"
  );
}

async function* publishPreflightResult(params: {
  input: NcpAgentRunInput;
  result: {
    contextWindow: ContextWindowSnapshot;
    sessionMessages: readonly NcpMessage[];
    timelineMessage: NcpMessage | null;
  };
  stateManager: RuntimeFactoryParams["stateManager"];
}): AsyncGenerator<NcpEndpointEvent> {
  const { input, result, stateManager } = params;
  const contextWindowEvent = createContextWindowUpdatedEvent({
    contextWindow: result.contextWindow,
    sessionId: input.sessionId,
  });
  await stateManager.dispatch(contextWindowEvent);
  yield contextWindowEvent;
  if (!result.timelineMessage) {
    return;
  }
  const activeRun = stateManager.getSnapshot().activeRun;
  stateManager.hydrate({
    sessionId: input.sessionId,
    messages: result.sessionMessages,
    activeRun,
    contextWindow: result.contextWindow,
  });
  const timelineEvent = {
    type: NcpEventType.MessageSent,
    payload: {
      sessionId: input.sessionId,
      message: result.timelineMessage,
    },
  } as const;
  await stateManager.dispatch(timelineEvent);
  yield timelineEvent;
}

export class NativeAgentRuntimeFactory {
  private readonly observedProviderManager: LlmProviderRuntime;

  constructor(private readonly options: NativeAgentRuntimeFactoryOptions) {
    this.observedProviderManager = options.llmUsage.observeProviderManager(
      options.providerManager,
      "ui-ncp",
    );
  }

  create: NativeRuntimeFactory = ({
    agentId,
    stateManager,
    sessionMetadata,
    setSessionMetadata,
  }: RuntimeFactoryParams): NcpAgentRuntime => {
    let runtimeSessionMetadata = structuredClone(sessionMetadata);
    const patchSessionMetadata = (nextMetadata: Record<string, unknown>): void => {
      runtimeSessionMetadata = { ...runtimeSessionMetadata, ...structuredClone(nextMetadata) };
      setSessionMetadata(runtimeSessionMetadata);
    };
    const reasoningNormalizationMode = resolveNativeReasoningNormalizationMode({
      config: this.options.configManager.loadConfig(),
      sessionMetadata: runtimeSessionMetadata,
    });
    if (
      reasoningNormalizationMode !== "off" &&
      readAssistantReasoningNormalizationModeFromMetadata(sessionMetadata) !== reasoningNormalizationMode
    ) {
      patchSessionMetadata(
        writeAssistantReasoningNormalizationModeToMetadata(
          runtimeSessionMetadata,
          reasoningNormalizationMode,
        ),
      );
    }

    const toolRegistry = this.createToolRegistry();
    const runtime = new DefaultNcpAgentRuntime({
      contextBuilder: new NextclawNcpContextBuilder({
        agentId,
        getSessionMetadata: () => runtimeSessionMetadata,
        toolRegistry,
        getConfig: this.options.configManager.loadConfig,
        assetStore: this.options.assetStore,
      }),
      llmApi: new ProviderManagerNcpLLMApi(this.observedProviderManager),
      toolRegistry,
      stateManager,
      reasoningNormalizationMode,
    });
    const contextCompactionManager = new ContextCompactionManager({
      getConfig: this.options.configManager.loadConfig,
      providerManager: this.observedProviderManager,
    });
    const { onSessionUpdated } = this.options;
    return {
      run: async function* (input, options) {
        const beginResult = contextCompactionManager.begin({
          contextWindowOwner: "nextclaw",
          inputMessages: input.messages,
          requestMetadata: input.metadata ?? {},
          sessionId: input.sessionId,
          sessionMessages: stateManager.getSnapshot().messages,
          storedAgentId: agentId,
          storedMetadata: runtimeSessionMetadata,
        });
        if (beginResult) {
          patchSessionMetadata(beginResult.metadata);
          onSessionUpdated(input.sessionId);
          yield* publishPreflightResult({
            input,
            result: beginResult,
            stateManager,
          });
          if (beginResult.pendingCompaction) {
            const finishResult = await contextCompactionManager.finish(beginResult.pendingCompaction);
            patchSessionMetadata(finishResult.metadata);
            onSessionUpdated(input.sessionId);
            yield* publishPreflightResult({
              input,
              result: finishResult,
              stateManager,
            });
          }
        }
        yield* runtime.run(input, options);
      },
    };
  };

  private createToolRegistry = () => {
    return this.options.toolManager.createRuntimeRegistry({
      updateToolCallResult: this.options.updateToolCallResult,
    });
  };
}

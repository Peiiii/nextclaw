import {
  type Config,
  type ContextWindowSnapshot,
  type CronService,
  type GatewayController,
  type MessageBus,
  type SessionManager,
  type SessionRequestManager,
  type SessionSearchManager,
} from "@nextclaw/core";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import { DefaultNcpAgentRuntime, type LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import type { McpNcpToolRegistryAdapter } from "@nextclaw/ncp-mcp";
import {
  type NcpAgentRunInput,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  NcpEventType,
  type NcpMessage,
  type NcpTool,
  readAssistantReasoningNormalizationMode,
  readAssistantReasoningNormalizationModeFromMetadata,
  type NcpAssistantReasoningNormalizationMode,
  writeAssistantReasoningNormalizationModeToMetadata,
} from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import { type LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import type { ExtensionManager } from "@kernel/managers/extension.manager.js";
import { SessionSearchTool } from "@kernel/tools/session-search.tools.js";
import { createAssetTools } from "@kernel/features/native-runtime/tools/ncp-asset.tools.js";
import { ContextCompactionPreflightService } from "./context-compaction-preflight.service.js";
import { NextclawNcpContextBuilder } from "./nextclaw-ncp-context-builder.service.js";
import { NextclawNcpToolRegistry } from "./nextclaw-ncp-tool-registry.service.js";
import { ProviderManagerNcpLLMApi } from "./provider-manager-ncp-llm-api.service.js";

export type NativeRuntimeFactory = (runtimeParams: RuntimeFactoryParams) => NcpAgentRuntime;

export type UpdateToolCallResult = (params: {
  sessionId: string;
  toolCallId: string;
  result: unknown;
}) => Promise<void>;

export type NativeAgentRuntimeFactoryOptions = {
  bus: MessageBus;
  providerManager: LlmProviderRuntime;
  sessions: SessionManager;
  sessionRequests: SessionRequestManager;
  sessionSearch: SessionSearchManager;
  cronService?: CronService | null;
  configManager: { loadConfig: () => Config };
  extensions: ExtensionManager;
  llmUsage: LlmUsageManager;
  onSessionUpdated: (sessionKey: string) => void;
  resolveGatewayController: () => GatewayController | undefined;
  mcpToolRegistryAdapter: McpNcpToolRegistryAdapter;
  assetStore: LocalAssetStore;
  updateToolCallResult: UpdateToolCallResult;
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

function createSessionSearchTools(params: {
  currentSessionId: string;
  sessionSearch: SessionSearchManager;
}): NcpTool[] {
  const { currentSessionId, sessionSearch } = params;
  return sessionSearch.isReady()
    ? [new SessionSearchTool({ search: sessionSearch.search }, { currentSessionId })]
    : [];
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
    stateManager,
    sessionMetadata,
    setSessionMetadata,
  }: RuntimeFactoryParams): NcpAgentRuntime => {
    const reasoningNormalizationMode = resolveNativeReasoningNormalizationMode({
      config: this.options.configManager.loadConfig(),
      sessionMetadata,
    });
    if (
      reasoningNormalizationMode !== "off" &&
      readAssistantReasoningNormalizationModeFromMetadata(sessionMetadata) !== reasoningNormalizationMode
    ) {
      setSessionMetadata(
        writeAssistantReasoningNormalizationModeToMetadata(
          sessionMetadata,
          reasoningNormalizationMode,
        ),
      );
    }

    const toolRegistry = this.createToolRegistry(this.observedProviderManager);
    const runtime = new DefaultNcpAgentRuntime({
      contextBuilder: new NextclawNcpContextBuilder({
        sessionManager: this.options.sessions,
        toolRegistry,
        getConfig: this.options.configManager.loadConfig,
        resolveMessageToolHints: ({ channel, accountId }) =>
          this.options.extensions.resolveMessageToolHints({
            channel,
            config: this.options.configManager.loadConfig(),
            accountId,
          }),
        assetStore: this.options.assetStore,
      }),
      llmApi: new ProviderManagerNcpLLMApi(this.observedProviderManager),
      toolRegistry,
      stateManager,
      reasoningNormalizationMode,
    });
    const contextCompactionPreflight = new ContextCompactionPreflightService({
      getConfig: this.options.configManager.loadConfig,
      providerManager: this.observedProviderManager,
      sessionManager: this.options.sessions,
    });
    const { onSessionUpdated } = this.options;
    return {
      run: async function* (input, options) {
        const beginResult = contextCompactionPreflight.begin({
          contextWindowOwner: "nextclaw",
          inputMessages: input.messages,
          requestMetadata: input.metadata ?? {},
          sessionId: input.sessionId,
          sessionMessages: stateManager.getSnapshot().messages,
        });
        if (beginResult) {
          setSessionMetadata(beginResult.metadata);
          onSessionUpdated(input.sessionId);
          yield* publishPreflightResult({
            input,
            result: beginResult,
            stateManager,
          });
          if (beginResult.pendingCompaction) {
            const finishResult = await contextCompactionPreflight.finish(beginResult.pendingCompaction);
            setSessionMetadata(finishResult.metadata);
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

  resolveOpenAiToolsForRuntime = (input: NcpAgentRunInput) => {
    const contextBuilder = new NextclawNcpContextBuilder({
      sessionManager: this.options.sessions,
      toolRegistry: this.createToolRegistry(this.options.providerManager),
      getConfig: this.options.configManager.loadConfig,
      resolveMessageToolHints: ({ channel, accountId }) =>
        this.options.extensions.resolveMessageToolHints({
          channel,
          config: this.options.configManager.loadConfig(),
          accountId,
        }),
      assetStore: this.options.assetStore,
    });
    return contextBuilder.prepare(input).tools;
  };

  private createToolRegistry = (
    providerManager: LlmProviderRuntime,
  ): NextclawNcpToolRegistry => {
    return new NextclawNcpToolRegistry({
      bus: this.options.bus,
      providerManager,
      sessionManager: this.options.sessions,
      cronService: this.options.cronService,
      gatewayController: this.options.resolveGatewayController(),
      getConfig: this.options.configManager.loadConfig,
      getExtensionRegistry: this.options.extensions.getExtensionRegistry,
      onSessionUpdated: this.options.onSessionUpdated,
      sessionRequestManager: this.options.sessionRequests,
      updateToolCallResult: this.options.updateToolCallResult,
      getAdditionalTools: (context) => [
        ...createAssetTools({
          assetStore: this.options.assetStore,
        }),
        ...this.options.mcpToolRegistryAdapter.listToolsForRun({
          agentId: context.agentId,
        }),
        ...createSessionSearchTools({
          sessionSearch: this.options.sessionSearch,
          currentSessionId: context.sessionId,
        }),
      ],
    });
  };
}

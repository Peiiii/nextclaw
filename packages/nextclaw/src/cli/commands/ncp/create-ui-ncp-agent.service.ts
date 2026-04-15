import {
  type Config,
  type CronService,
  type GatewayController,
  getDataDir,
  type GlobalTypedEventBus,
  type MessageBus,
  type ProviderManager,
  type SessionManager,
} from "@nextclaw/core";
import { McpRegistryService, McpServerLifecycleManager } from "@nextclaw/mcp";
import { DefaultNcpAgentRuntime, LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import { McpNcpToolRegistryAdapter } from "@nextclaw/ncp-mcp";
import {
  type NcpAgentRuntime,
  readAssistantReasoningNormalizationMode,
  readAssistantReasoningNormalizationModeFromMetadata,
  writeAssistantReasoningNormalizationModeToMetadata,
  type NcpAssistantReasoningNormalizationMode,
} from "@nextclaw/ncp";
import { DefaultNcpAgentBackend, type RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import type { NextclawExtensionRegistry } from "../plugins.js";
import { createAssetTools } from "./runtime/ncp-asset-tools.js";
import { NextclawNcpContextBuilder } from "./nextclaw-ncp-context-builder.js";
import { NextclawAgentSessionStore } from "./nextclaw-agent-session-store.js";
import { NextclawNcpToolRegistry } from "./nextclaw-ncp-tool-registry.js";
import { ProviderManagerNcpLLMApi } from "./provider/provider-manager-ncp-llm-api.js";
import { SessionCreationService } from "./session-request/session-creation.service.js";
import { SessionRequestBroker } from "./session-request/session-request-broker.service.js";
import { SessionRequestDeliveryService } from "./session-request/session-request-delivery.service.js";
import { SessionSearchRuntimeSupport } from "./session-search/session-search-runtime.service.js";
import { UiNcpRuntimeRegistry } from "./ui-ncp-runtime-registry.js";
import { LlmUsageObserver, ObservedProviderManager } from "../shared/llm-usage-observer.js";
import {
  createUiNcpAgentHandle,
  type UiNcpAgentHandle,
} from "./runtime/ui-ncp-agent-handle.js";
import {
  LearningLoopRuntimeService,
  readLearningLoopRuntimeConfig,
} from "../learning-loop/index.js";
import { PluginRuntimeRegistrationController } from "./plugin-runtime-registration.controller.js";
import { join } from "node:path";
import { llmUsageRecorder } from "../shared/llm-usage-recorder.js";

export type { UiNcpAgentHandle } from "./runtime/ui-ncp-agent-handle.js";
type MessageToolHintsResolver = (params: {
  sessionKey: string;
  channel: string;
  chatId: string;
  accountId?: string | null;
}) => string[];
type CreateUiNcpAgentParams = {
  bus: MessageBus;
  providerManager: ProviderManager;
  sessionManager: SessionManager;
  cronService?: CronService | null;
  gatewayController?: GatewayController;
  getConfig: () => Config;
  getExtensionRegistry?: () => NextclawExtensionRegistry | undefined;
  resolveMessageToolHints?: MessageToolHintsResolver;
  onSessionUpdated?: (sessionKey: string) => void;
  onSessionRunStatusChanged?: (payload: {
    sessionKey: string;
    status: "running" | "idle";
  }) => void;
  globalEventBus?: GlobalTypedEventBus;
};
type RuntimeFactory = (runtimeParams: RuntimeFactoryParams) => NcpAgentRuntime;
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveNativeReasoningNormalizationMode(params: {
  config: Config;
  sessionMetadata: Record<string, unknown>;
}): NcpAssistantReasoningNormalizationMode {
  const runtimeEntry = params.config.ui.ncp.runtimes.native;
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

async function createMcpRuntimeSupport(getConfig: () => Config): Promise<{
  toolRegistryAdapter: McpNcpToolRegistryAdapter;
  applyMcpConfig: (config: Config) => Promise<void>;
  dispose: () => Promise<void>;
}> {
  let currentMcpConfig = getConfig();
  const mcpLifecycleManager = new McpServerLifecycleManager({
    getConfig: () => currentMcpConfig,
  });
  const mcpRegistryService = new McpRegistryService({
    getConfig: () => currentMcpConfig,
    lifecycleManager: mcpLifecycleManager,
  });
  const mcpPrewarmResults = await mcpRegistryService.prewarmEnabledServers();
  for (const result of mcpPrewarmResults) {
    if (!result.ok) {
      console.warn(`[mcp] Failed to warm ${result.name}: ${result.error}`);
    }
  }

  return {
    toolRegistryAdapter: new McpNcpToolRegistryAdapter(mcpRegistryService),
    applyMcpConfig: async (config) => {
      const previousConfig = currentMcpConfig;
      currentMcpConfig = config;
      const reconcileResult = await mcpRegistryService.reconcileConfig({
        prevConfig: previousConfig,
        nextConfig: config,
      });

      for (const warmResult of reconcileResult.warmed) {
        if (!warmResult.ok) {
          console.warn(`[mcp] Failed to warm ${warmResult.name}: ${warmResult.error}`);
        }
      }
    },
    dispose: async () => {
      await mcpRegistryService.close();
    },
  };
}

function createNativeRuntimeFactory(
  params: CreateUiNcpAgentParams,
  mcpToolRegistryAdapter: McpNcpToolRegistryAdapter,
  assetStore: LocalAssetStore,
  sessionCreationService: SessionCreationService,
  sessionRequestBroker: SessionRequestBroker,
  sessionSearchRuntimeSupport: SessionSearchRuntimeSupport,
): RuntimeFactory {
  const observedProviderManager = new ObservedProviderManager(
    params.providerManager,
    new LlmUsageObserver(llmUsageRecorder, "ui-ncp")
  );
  return ({
    stateManager,
    sessionMetadata,
    setSessionMetadata,
  }: RuntimeFactoryParams) => {
    const reasoningNormalizationMode = resolveNativeReasoningNormalizationMode({
      config: params.getConfig(),
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

    const toolRegistry = new NextclawNcpToolRegistry({
      bus: params.bus,
      providerManager: observedProviderManager,
      sessionManager: params.sessionManager,
      cronService: params.cronService,
      gatewayController: params.gatewayController,
      getConfig: params.getConfig,
      getExtensionRegistry: params.getExtensionRegistry,
      sessionCreationService,
      sessionRequestBroker,
      getAdditionalTools: (context) => [
        ...createAssetTools({
          assetStore,
        }),
        ...mcpToolRegistryAdapter.listToolsForRun({
          agentId: context.agentId,
        }),
        sessionSearchRuntimeSupport.createTool({
          currentSessionId: context.sessionId,
        }),
      ],
    });
    return new DefaultNcpAgentRuntime({
      contextBuilder: new NextclawNcpContextBuilder({
        sessionManager: params.sessionManager,
        toolRegistry,
        getConfig: params.getConfig,
        resolveMessageToolHints: params.resolveMessageToolHints,
        assetStore,
      }),
      llmApi: new ProviderManagerNcpLLMApi(observedProviderManager),
      toolRegistry,
      stateManager,
      reasoningNormalizationMode,
    });
  };
}

export async function createUiNcpAgent(params: CreateUiNcpAgentParams): Promise<UiNcpAgentHandle> {
  const {
    getConfig,
    getExtensionRegistry,
    globalEventBus,
    onSessionRunStatusChanged,
    onSessionUpdated,
    providerManager,
    resolveMessageToolHints,
    sessionManager,
  } = params;
  const sessionSearchRuntimeSupport = new SessionSearchRuntimeSupport({
    sessionManager,
    onSessionUpdated,
    databasePath: join(getDataDir(), "session-search.db"),
  });
  const sessionStore = new NextclawAgentSessionStore(sessionManager, {
    onSessionUpdated: sessionSearchRuntimeSupport.handleSessionUpdated,
  });
  const runtimeRegistry = new UiNcpRuntimeRegistry();
  const { toolRegistryAdapter, applyMcpConfig, dispose: disposeMcpRuntimeSupport } =
    await createMcpRuntimeSupport(getConfig);
  const assetStore = new LocalAssetStore({
    rootDir: join(getDataDir(), "assets"),
  });
  let backend: DefaultNcpAgentBackend | null = null;
  const sessionCreationService = new SessionCreationService(
    sessionManager,
    getConfig,
    sessionSearchRuntimeSupport.handleSessionUpdated,
  );
  const sessionRequestBroker = new SessionRequestBroker(
    sessionManager,
    sessionCreationService,
    new SessionRequestDeliveryService(() => backend),
    () => backend,
    sessionSearchRuntimeSupport.handleSessionUpdated,
  );
  const learningLoopRuntime = new LearningLoopRuntimeService({
    sessionManager,
    sessionRequestBroker,
    onSessionUpdated: sessionSearchRuntimeSupport.handleSessionUpdated,
    globalEventBus,
    resolveLearningLoopConfig: () => readLearningLoopRuntimeConfig(getConfig()),
  });
  const createNativeRuntime = createNativeRuntimeFactory(
    {
      ...params,
      getConfig,
      getExtensionRegistry,
      onSessionUpdated,
      providerManager,
      resolveMessageToolHints,
      sessionManager,
    },
    toolRegistryAdapter,
    assetStore,
    sessionCreationService,
    sessionRequestBroker,
    sessionSearchRuntimeSupport,
  );

  runtimeRegistry.register({
    kind: "native",
    label: "Native",
    createRuntime: createNativeRuntime,
  });

  const pluginRuntimeRegistrationController = new PluginRuntimeRegistrationController(
    runtimeRegistry,
    getExtensionRegistry,
  );
  pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations();
  await sessionSearchRuntimeSupport.initialize();

  backend = new DefaultNcpAgentBackend({
    endpointId: "nextclaw-ui-agent",
    sessionStore,
    onSessionRunStatusChanged,
    createRuntime: (runtimeParams) => {
      pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations();
      return runtimeRegistry.createRuntime({
        ...runtimeParams,
        resolveAssetContentPath: (assetUri) => assetStore.resolveContentPath(assetUri),
      });
    },
  });

  await backend.start();
  learningLoopRuntime.attachBackend(backend);

  return createUiNcpAgentHandle({
    backend,
    runtimeRegistry,
    refreshPluginRuntimeRegistrations:
      pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations,
    applyExtensionRegistry: pluginRuntimeRegistrationController.applyExtensionRegistry,
    applyMcpConfig,
    dispose: async () => {
      learningLoopRuntime.dispose();
      pluginRuntimeRegistrationController.dispose();
      await backend?.stop();
      await sessionSearchRuntimeSupport.dispose();
      await disposeMcpRuntimeSupport();
    },
    assetStore,
  });
}

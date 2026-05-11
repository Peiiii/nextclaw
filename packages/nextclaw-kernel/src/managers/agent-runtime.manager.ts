import {
  type Config,
  type CronService,
  type GatewayController,
  getDataDir,
  type MessageBus,
  type SessionManager,
} from "@nextclaw/core";
import { eventKeys, type EventBus } from "@nextclaw/shared";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import { DefaultNcpAgentRuntime, LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import type { McpNcpToolRegistryAdapter } from "@nextclaw/ncp-mcp";
import {
  type NcpEndpointEvent,
  type NcpAgentRunInput,
  type NcpAgentRuntime,
  type NcpMessage,
  readAssistantReasoningNormalizationMode,
  readAssistantReasoningNormalizationModeFromMetadata,
  writeAssistantReasoningNormalizationModeToMetadata,
  type NcpAssistantReasoningNormalizationMode,
  NcpEventType,
} from "@nextclaw/ncp";
import { DefaultNcpAgentBackend, type RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import { join } from "node:path";
import type { ExtensionManager } from "@kernel/managers/extension.manager.js";
import { createAssetTools } from "@kernel/agent-runtime/features/runtime/ncp-asset-tools.utils.js";
import { NextclawNcpContextBuilder } from "@kernel/agent-runtime/nextclaw-ncp-context-builder.service.js";
import { NextclawAgentSessionStore } from "@kernel/agent-runtime/nextclaw-agent-session.store.js";
import { NextclawNcpToolRegistry } from "@kernel/agent-runtime/nextclaw-ncp-tool-registry.service.js";
import { ProviderManagerNcpLLMApi } from "@kernel/agent-runtime/provider/provider-manager-ncp-llm-api.service.js";
import { SessionCreationService } from "@kernel/agent-runtime/session-request/session-creation.service.js";
import { SessionRequestBroker } from "@kernel/agent-runtime/session-request/session-request-broker.service.js";
import { SessionRequestDeliveryService } from "@kernel/agent-runtime/session-request/session-request-delivery.service.js";
import { SessionSearchRuntimeSupport } from "@kernel/agent-runtime/session-search/session-search-runtime.service.js";
import { AgentRuntimeRegistry } from "@kernel/agent-runtime/agent-runtime-registry.service.js";
import {
  createAgentRuntimeHandle,
  type AgentRuntimeHandle,
} from "@kernel/agent-runtime/features/runtime/agent-runtime-handle.utils.js";
import { PluginRuntimeRegistrationController } from "@kernel/agent-runtime/plugin-runtime-registration.controller.js";
import { BuiltinNarpRuntimeRegistrationService } from "@kernel/agent-runtime/builtin-narp-runtime-registration.service.js";
import type { LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import { resolveAgentRuntimeEntries } from "@kernel/agent-runtime/agent-runtime-entry-resolver.utils.js";
import { ContextCompactionPreflightService } from "@kernel/agent-runtime/context/context-compaction-preflight.service.js";
import type { ContextWindowSnapshot } from "@kernel/agent-runtime/context/context-window-snapshot.utils.js";
import { McpRuntimeSupportOwner, type McpRuntimeSupport } from "@kernel/agent-runtime/mcp-runtime-support.service.js";
import { NcpLifecycleEventBridge } from "@kernel/agent-runtime/shared/lifecycle-events/ncp-lifecycle-event-bridge.service.js";

export type { AgentRuntimeHandle } from "@kernel/agent-runtime/features/runtime/agent-runtime-handle.utils.js";

export type AgentRuntimeManagerOptions = {
  bus: MessageBus;
  providerManager: LlmProviderRuntime;
  sessionManager: SessionManager;
  cronService?: CronService | null;
  configManager: { loadConfig: () => Config };
  extensions: ExtensionManager;
  eventBus: EventBus;
  llmUsage: LlmUsageManager;
};

type RuntimeFactory = (runtimeParams: RuntimeFactoryParams) => NcpAgentRuntime;

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

function createNativeRuntimeFactory(
  params: AgentRuntimeManagerOptions,
  resolveGatewayController: () => GatewayController | undefined,
  mcpToolRegistryAdapter: McpNcpToolRegistryAdapter,
  assetStore: LocalAssetStore,
  sessionCreationService: SessionCreationService,
  sessionRequestBroker: SessionRequestBroker,
  sessionSearchRuntimeSupport: SessionSearchRuntimeSupport,
): RuntimeFactory {
  const observedProviderManager = params.llmUsage.observeProviderManager(
    params.providerManager,
    "ui-ncp",
  );
  return ({
    stateManager,
    sessionMetadata,
    setSessionMetadata,
  }: RuntimeFactoryParams) => {
    const reasoningNormalizationMode = resolveNativeReasoningNormalizationMode({
      config: params.configManager.loadConfig(),
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
      gatewayController: resolveGatewayController(),
      getConfig: params.configManager.loadConfig,
      getExtensionRegistry: params.extensions.getExtensionRegistry,
      sessionCreationService,
      sessionRequestBroker,
      getAdditionalTools: (context) => [
        ...createAssetTools({
          assetStore,
        }),
        ...mcpToolRegistryAdapter.listToolsForRun({
          agentId: context.agentId,
        }),
        ...sessionSearchRuntimeSupport.createAdditionalTools({
          currentSessionId: context.sessionId,
        }),
      ],
    });
    const runtime = new DefaultNcpAgentRuntime({
      contextBuilder: new NextclawNcpContextBuilder({
        sessionManager: params.sessionManager,
        toolRegistry,
        getConfig: params.configManager.loadConfig,
        resolveMessageToolHints: ({ channel, accountId }) =>
          params.extensions.resolveMessageToolHints({
            channel,
            config: params.configManager.loadConfig(),
            accountId,
          }),
        assetStore,
      }),
      llmApi: new ProviderManagerNcpLLMApi(observedProviderManager),
      toolRegistry,
      stateManager,
      reasoningNormalizationMode,
    });
    const contextCompactionPreflight = new ContextCompactionPreflightService({
      getConfig: params.configManager.loadConfig,
      providerManager: observedProviderManager,
      sessionManager: params.sessionManager,
    });
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
          params.eventBus.emit(eventKeys.sessionUpdated, { sessionKey: input.sessionId }, {
            emittedAt: new Date().toISOString(),
            source: "backend",
          });
          yield* publishPreflightResult({
            input,
            result: beginResult,
            stateManager,
          });
          if (beginResult.pendingCompaction) {
            const finishResult = await contextCompactionPreflight.finish(beginResult.pendingCompaction);
            setSessionMetadata(finishResult.metadata);
            params.eventBus.emit(eventKeys.sessionUpdated, { sessionKey: input.sessionId }, {
              emittedAt: new Date().toISOString(),
              source: "backend",
            });
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

function createResolveOpenAiToolsForRuntime(params: {
  bus: MessageBus;
  providerManager: LlmProviderRuntime;
  sessionManager: SessionManager;
  cronService?: CronService | null;
  gatewayController?: GatewayController;
  getConfig: () => Config;
  extensions: ExtensionManager;
  assetStore: LocalAssetStore;
  toolRegistryAdapter: McpNcpToolRegistryAdapter;
  sessionCreationService: SessionCreationService;
  sessionRequestBroker: SessionRequestBroker;
  sessionSearchRuntimeSupport: SessionSearchRuntimeSupport;
}) {
  const {
    assetStore,
    bus,
    cronService,
    extensions,
    gatewayController,
    getConfig,
    providerManager,
    sessionCreationService,
    sessionManager,
    sessionRequestBroker,
    sessionSearchRuntimeSupport,
    toolRegistryAdapter,
  } = params;
  const toolRegistry = new NextclawNcpToolRegistry({
    bus,
    providerManager,
    sessionManager,
    cronService,
    gatewayController,
    getConfig,
    getExtensionRegistry: extensions.getExtensionRegistry,
    sessionCreationService,
    sessionRequestBroker,
    getAdditionalTools: (context) => [
      ...createAssetTools({
        assetStore,
      }),
      ...toolRegistryAdapter.listToolsForRun({
        agentId: context.agentId,
      }),
      ...sessionSearchRuntimeSupport.createAdditionalTools({
        currentSessionId: context.sessionId,
      }),
    ],
  });
  const contextBuilder = new NextclawNcpContextBuilder({
    sessionManager,
    toolRegistry,
    getConfig,
    resolveMessageToolHints: ({ channel, accountId }) =>
      extensions.resolveMessageToolHints({
        channel,
        config: getConfig(),
        accountId,
      }),
    assetStore,
  });

  return (input: NcpAgentRunInput) => contextBuilder.prepare(input).tools;
}

export class AgentRuntimeManager {
  private readonly sessionSearchRuntimeSupport: SessionSearchRuntimeSupport;
  private readonly sessionStore: NextclawAgentSessionStore;
  private readonly runtimeRegistry = new AgentRuntimeRegistry();
  private readonly mcpRuntimeSupport: McpRuntimeSupport;
  private readonly lifecycleEventBridge: NcpLifecycleEventBridge;
  private readonly assetStore = new LocalAssetStore({
    rootDir: join(getDataDir(), "assets"),
  });
  private readonly sessionCreationService: SessionCreationService;
  readonly sessionRequestBroker: SessionRequestBroker;
  private readonly pluginRuntimeRegistrationController: PluginRuntimeRegistrationController;
  private readonly refreshConfiguredRuntimeEntries = () => {
    this.runtimeRegistry.applyEntries(
      resolveAgentRuntimeEntries({
        config: this.params.configManager.loadConfig(),
        providerKinds: this.runtimeRegistry.listProviderKinds(),
      }),
    );
  };

  private backend: DefaultNcpAgentBackend | null = null;
  private handle: AgentRuntimeHandle | null = null;
  private builtinNarpRegistrations: Array<{ dispose: () => void }> = [];
  private kernelBootstrapped = false;
  private warmupPromise: Promise<void> | null = null;
  private unsubscribeNcpEvents: (() => void) | null = null;
  private gatewayController: GatewayController | undefined;
  private disposed = false;

  constructor(private readonly params: AgentRuntimeManagerOptions) {
    this.sessionSearchRuntimeSupport = new SessionSearchRuntimeSupport({
      sessionManager: params.sessionManager,
      onSessionUpdated: this.publishSessionUpdated,
      databasePath: join(getDataDir(), "session-search.db"),
    });
    this.sessionStore = new NextclawAgentSessionStore(params.sessionManager, {
      onSessionUpdated: this.sessionSearchRuntimeSupport.handleSessionUpdated,
    });
    this.mcpRuntimeSupport = new McpRuntimeSupportOwner(params.configManager.loadConfig);
    this.lifecycleEventBridge = new NcpLifecycleEventBridge(
      params.sessionManager,
      params.eventBus,
    );
    this.sessionCreationService = new SessionCreationService(
      params.sessionManager,
      params.configManager.loadConfig,
      this.sessionSearchRuntimeSupport.handleSessionUpdated,
    );
    this.sessionRequestBroker = new SessionRequestBroker(
      params.sessionManager,
      this.sessionCreationService,
      new SessionRequestDeliveryService(() => this.backend),
      () => this.backend,
      this.sessionSearchRuntimeSupport.handleSessionUpdated,
    );
    this.pluginRuntimeRegistrationController = new PluginRuntimeRegistrationController(
      this.runtimeRegistry,
      params.extensions,
    );
  }

  get currentHandle(): AgentRuntimeHandle | null {
    return this.handle;
  }

  connectGatewayController = (gatewayController: GatewayController): void => {
    this.assertNotDisposed();
    this.gatewayController = gatewayController;
  };

  bootstrap = async (): Promise<AgentRuntimeHandle> => {
    this.assertNotDisposed();
    if (this.handle) {
      return this.handle;
    }
    this.registerCoreRuntimes();
    const contextWindowPreview = new ContextCompactionPreflightService({
      getConfig: this.params.configManager.loadConfig,
      sessionManager: this.params.sessionManager,
    });

    this.backend = new DefaultNcpAgentBackend({
      endpointId: "nextclaw-ui-agent",
      sessionStore: this.sessionStore,
      onSessionRunStatusChanged: this.publishSessionRunStatus,
      resolveSessionContextWindow: ({ messages, metadata, sessionId }) =>
        contextWindowPreview.preview({
          contextWindowOwner: "nextclaw",
          requestMetadata: metadata,
          sessionId,
          sessionMessages: messages,
        }),
      createRuntime: (runtimeParams) => {
        this.pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations();
        this.refreshConfiguredRuntimeEntries();
        return this.runtimeRegistry.createRuntime({
          ...runtimeParams,
          resolveAssetContentPath: (assetUri) => this.assetStore.resolveContentPath(assetUri),
          resolveTools: createResolveOpenAiToolsForRuntime({
            bus: this.params.bus,
            providerManager: this.params.providerManager,
            sessionManager: this.params.sessionManager,
            cronService: this.params.cronService,
            gatewayController: this.gatewayController,
            getConfig: this.params.configManager.loadConfig,
            extensions: this.params.extensions,
            assetStore: this.assetStore,
            toolRegistryAdapter: this.mcpRuntimeSupport.toolRegistryAdapter,
            sessionCreationService: this.sessionCreationService,
            sessionRequestBroker: this.sessionRequestBroker,
            sessionSearchRuntimeSupport: this.sessionSearchRuntimeSupport,
          }),
        });
      },
    });
    this.unsubscribeNcpEvents = this.backend.subscribe(this.publishNcpEvent);

    await this.backend.start();
    this.handle = createAgentRuntimeHandle({
      backend: this.backend,
      runtimeRegistry: this.runtimeRegistry,
      refreshPluginRuntimeRegistrations:
        this.pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations,
      refreshConfiguredRuntimeEntries: this.refreshConfiguredRuntimeEntries,
      applyMcpConfig: this.mcpRuntimeSupport.applyMcpConfig,
      dispose: this.dispose,
      assetStore: this.assetStore,
    });
    return this.handle;
  };

  warmDerivedCapabilities = async (): Promise<void> => {
    this.assertNotDisposed();
    this.warmupPromise ??= this.runDerivedCapabilityWarmup();
    await this.warmupPromise;
  };

  dispose = async (): Promise<void> => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    await this.warmupPromise?.catch(() => undefined);
    this.unsubscribeNcpEvents?.();
    this.unsubscribeNcpEvents = null;
    for (const registration of this.builtinNarpRegistrations) {
      registration.dispose();
    }
    this.pluginRuntimeRegistrationController.dispose();
    await this.backend?.stop();
    await this.sessionSearchRuntimeSupport.dispose();
    await this.mcpRuntimeSupport.dispose();
  };

  private readonly registerCoreRuntimes = (): void => {
    if (this.kernelBootstrapped) {
      return;
    }
    this.kernelBootstrapped = true;
    this.runtimeRegistry.register({
      kind: "native",
      label: "Native",
      createRuntime: createNativeRuntimeFactory(
        this.params,
        () => this.gatewayController,
        this.mcpRuntimeSupport.toolRegistryAdapter,
        this.assetStore,
        this.sessionCreationService,
        this.sessionRequestBroker,
        this.sessionSearchRuntimeSupport,
      ),
    });
    const builtinNarpRegistrationService = new BuiltinNarpRuntimeRegistrationService(
      this.params.configManager.loadConfig,
    );
    this.builtinNarpRegistrations = builtinNarpRegistrationService.registerInto(this.runtimeRegistry);
    this.pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations();
    this.refreshConfiguredRuntimeEntries();
  };

  private runDerivedCapabilityWarmup = async (): Promise<void> => {
    await this.sessionSearchRuntimeSupport.initialize();
    const mcpWarmResults = await this.mcpRuntimeSupport.prewarmEnabledServers();
    for (const result of mcpWarmResults) {
      if (!result.ok) {
        console.warn(`[mcp] Failed to warm ${result.name}: ${result.error}`);
      }
    }
  };

  private publishSessionUpdated = (sessionKey: string): void => {
    this.lifecycleEventBridge.publishSessionUpdated(sessionKey);
    this.params.eventBus.emit(eventKeys.sessionUpdated, { sessionKey }, {
      emittedAt: new Date().toISOString(),
      source: "backend",
    });
  };

  private publishSessionRunStatus = (payload: {
    sessionKey: string;
    status: "running" | "idle";
  }): void => {
    this.params.eventBus.emit(eventKeys.sessionRunStatus, payload, {
      emittedAt: new Date().toISOString(),
      source: "backend",
    });
  };

  private publishNcpEvent = (event: NcpEndpointEvent): void => {
    this.params.eventBus.emit(eventKeys.ncpEvent, event, {
      emittedAt: new Date().toISOString(),
      source: "backend",
    });
    this.lifecycleEventBridge.handleEndpointEvent(event);
  };

  private readonly assertNotDisposed = (): void => {
    if (this.disposed) {
      throw new Error("Agent runtime has already been disposed.");
    }
  };
}

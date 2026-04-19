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
import { McpRegistryService, McpServerLifecycleManager, type McpServerWarmResult } from "@nextclaw/mcp";
import { DefaultNcpAgentRuntime, LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import { McpNcpToolRegistryAdapter } from "@nextclaw/ncp-mcp";
import {
  type NcpAgentRunInput,
  type NcpAgentRuntime,
  readAssistantReasoningNormalizationMode,
  readAssistantReasoningNormalizationModeFromMetadata,
  writeAssistantReasoningNormalizationModeToMetadata,
  type NcpAssistantReasoningNormalizationMode,
} from "@nextclaw/ncp";
import { DefaultNcpAgentBackend, type RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import { join } from "node:path";
import type { NextclawExtensionRegistry } from "@/cli/commands/plugin/index.js";
import { createAssetTools } from "./ncp-asset-tools.js";
import { NextclawNcpContextBuilder } from "@/cli/commands/ncp/nextclaw-ncp-context-builder.js";
import { NextclawAgentSessionStore } from "@/cli/commands/ncp/nextclaw-agent-session-store.js";
import { NextclawNcpToolRegistry } from "@/cli/commands/ncp/nextclaw-ncp-tool-registry.js";
import { ProviderManagerNcpLLMApi } from "@/cli/commands/ncp/provider/provider-manager-ncp-llm-api.js";
import { SessionCreationService } from "@/cli/commands/ncp/session-request/session-creation.service.js";
import { SessionRequestBroker } from "@/cli/commands/ncp/session-request/session-request-broker.service.js";
import { SessionRequestDeliveryService } from "@/cli/commands/ncp/session-request/session-request-delivery.service.js";
import { SessionSearchRuntimeSupport } from "@/cli/commands/ncp/session-search/session-search-runtime.service.js";
import { UiNcpRuntimeRegistry } from "@/cli/commands/ncp/ui-ncp-runtime-registry.js";
import { LlmUsageObserver, ObservedProviderManager } from "@/cli/shared/services/telemetry/llm-usage-observer.service.js";
import {
  createUiNcpAgentHandle,
  type UiNcpAgentHandle,
} from "./ui-ncp-agent-handle.service.js";
import {
  LearningLoopRuntimeService,
  readLearningLoopRuntimeConfig,
} from "@/cli/commands/learning-loop/index.js";
import { PluginRuntimeRegistrationController } from "@/cli/commands/ncp/plugin-runtime-registration.controller.js";
import { BuiltinNarpRuntimeRegistrationService } from "@/cli/commands/ncp/builtin-narp-runtime-registration.service.js";
import { llmUsageRecorder } from "@/cli/shared/services/telemetry/llm-usage-recorder.service.js";
import { resolveUiNcpRuntimeEntries } from "@/cli/commands/ncp/ui-ncp-runtime-entry-resolver.js";

export type { UiNcpAgentHandle } from "./ui-ncp-agent-handle.service.js";

type MessageToolHintsResolver = (params: {
  sessionKey: string;
  channel: string;
  chatId: string;
  accountId?: string | null;
}) => string[];

export type CreateUiNcpAgentParams = {
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

type McpRuntimeSupport = {
  toolRegistryAdapter: McpNcpToolRegistryAdapter;
  applyMcpConfig: (config: Config) => Promise<void>;
  prewarmEnabledServers: () => Promise<McpServerWarmResult[]>;
  dispose: () => Promise<void>;
};

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

function createMcpRuntimeSupport(getConfig: () => Config): McpRuntimeSupport {
  let currentMcpConfig = getConfig();
  const mcpLifecycleManager = new McpServerLifecycleManager({
    getConfig: () => currentMcpConfig,
  });
  const mcpRegistryService = new McpRegistryService({
    getConfig: () => currentMcpConfig,
    lifecycleManager: mcpLifecycleManager,
  });

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
    prewarmEnabledServers: async () => await mcpRegistryService.prewarmEnabledServers(),
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
        ...sessionSearchRuntimeSupport.createAdditionalTools({
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

function createResolveOpenAiToolsForRuntime(params: {
  bus: MessageBus;
  providerManager: ProviderManager;
  sessionManager: SessionManager;
  cronService?: CronService | null;
  gatewayController?: GatewayController;
  getConfig: () => Config;
  getExtensionRegistry?: () => NextclawExtensionRegistry | undefined;
  resolveMessageToolHints?: MessageToolHintsResolver;
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
    gatewayController,
    getConfig,
    getExtensionRegistry,
    providerManager,
    resolveMessageToolHints,
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
    getExtensionRegistry,
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
    resolveMessageToolHints,
    assetStore,
  });

  return (input: NcpAgentRunInput) => contextBuilder.prepare(input).tools;
}

export class UiNcpAgentRuntimeService {
  private readonly sessionSearchRuntimeSupport: SessionSearchRuntimeSupport;
  private readonly sessionStore: NextclawAgentSessionStore;
  private readonly runtimeRegistry = new UiNcpRuntimeRegistry();
  private readonly mcpRuntimeSupport: McpRuntimeSupport;
  private readonly assetStore = new LocalAssetStore({
    rootDir: join(getDataDir(), "assets"),
  });
  private readonly sessionCreationService: SessionCreationService;
  private readonly sessionRequestBroker: SessionRequestBroker;
  private readonly learningLoopRuntime: LearningLoopRuntimeService;
  private readonly pluginRuntimeRegistrationController: PluginRuntimeRegistrationController;
  private readonly refreshConfiguredRuntimeEntries = () => {
    this.runtimeRegistry.applyEntries(
      resolveUiNcpRuntimeEntries({
        config: this.params.getConfig(),
        providerKinds: this.runtimeRegistry.listProviderKinds(),
      }),
    );
  };

  private backend: DefaultNcpAgentBackend | null = null;
  private handle: UiNcpAgentHandle | null = null;
  private builtinNarpRegistrations: Array<{ dispose: () => void }> = [];
  private kernelBootstrapped = false;
  private warmupPromise: Promise<void> | null = null;
  private disposed = false;

  constructor(private readonly params: CreateUiNcpAgentParams) {
    this.sessionSearchRuntimeSupport = new SessionSearchRuntimeSupport({
      sessionManager: params.sessionManager,
      onSessionUpdated: params.onSessionUpdated,
      databasePath: join(getDataDir(), "session-search.db"),
    });
    this.sessionStore = new NextclawAgentSessionStore(params.sessionManager, {
      onSessionUpdated: this.sessionSearchRuntimeSupport.handleSessionUpdated,
    });
    this.mcpRuntimeSupport = createMcpRuntimeSupport(params.getConfig);
    this.sessionCreationService = new SessionCreationService(
      params.sessionManager,
      params.getConfig,
      this.sessionSearchRuntimeSupport.handleSessionUpdated,
    );
    this.sessionRequestBroker = new SessionRequestBroker(
      params.sessionManager,
      this.sessionCreationService,
      new SessionRequestDeliveryService(() => this.backend),
      () => this.backend,
      this.sessionSearchRuntimeSupport.handleSessionUpdated,
    );
    this.learningLoopRuntime = new LearningLoopRuntimeService({
      sessionManager: params.sessionManager,
      sessionRequestBroker: this.sessionRequestBroker,
      onSessionUpdated: this.sessionSearchRuntimeSupport.handleSessionUpdated,
      globalEventBus: params.globalEventBus,
      resolveLearningLoopConfig: () => readLearningLoopRuntimeConfig(params.getConfig()),
    });
    this.pluginRuntimeRegistrationController = new PluginRuntimeRegistrationController(
      this.runtimeRegistry,
      params.getExtensionRegistry,
    );
  }

  bootstrapKernel = async (): Promise<UiNcpAgentHandle> => {
    this.assertNotDisposed();
    if (this.handle) {
      return this.handle;
    }
    this.registerCoreRuntimes();

    this.backend = new DefaultNcpAgentBackend({
      endpointId: "nextclaw-ui-agent",
      sessionStore: this.sessionStore,
      onSessionRunStatusChanged: this.params.onSessionRunStatusChanged,
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
            gatewayController: this.params.gatewayController,
            getConfig: this.params.getConfig,
            getExtensionRegistry: this.params.getExtensionRegistry,
            resolveMessageToolHints: this.params.resolveMessageToolHints,
            assetStore: this.assetStore,
            toolRegistryAdapter: this.mcpRuntimeSupport.toolRegistryAdapter,
            sessionCreationService: this.sessionCreationService,
            sessionRequestBroker: this.sessionRequestBroker,
            sessionSearchRuntimeSupport: this.sessionSearchRuntimeSupport,
          }),
        });
      },
    });

    await this.backend.start();
    this.learningLoopRuntime.attachBackend(this.backend);
    this.handle = createUiNcpAgentHandle({
      backend: this.backend,
      runtimeRegistry: this.runtimeRegistry,
      refreshPluginRuntimeRegistrations:
        this.pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations,
      refreshConfiguredRuntimeEntries: this.refreshConfiguredRuntimeEntries,
      applyExtensionRegistry: this.pluginRuntimeRegistrationController.applyExtensionRegistry,
      applyMcpConfig: this.mcpRuntimeSupport.applyMcpConfig,
      dispose: this.dispose,
      assetStore: this.assetStore,
    });
    return this.handle;
  };

  recoverDurableState = async (): Promise<void> => {
    this.assertNotDisposed();
  };

  warmDerivedCapabilities = async (): Promise<void> => {
    this.assertNotDisposed();
    this.warmupPromise ??= this.runDerivedCapabilityWarmup();
    await this.warmupPromise;
  };

  getHandle = (): UiNcpAgentHandle | null => {
    return this.handle;
  };

  dispose = async (): Promise<void> => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    await this.warmupPromise?.catch(() => undefined);
    this.learningLoopRuntime.dispose();
    for (const registration of this.builtinNarpRegistrations) {
      registration.dispose();
    }
    this.pluginRuntimeRegistrationController.dispose();
    await this.backend?.stop();
    await this.sessionSearchRuntimeSupport.dispose();
    await this.mcpRuntimeSupport.dispose();
  };

  private registerCoreRuntimes(): void {
    if (this.kernelBootstrapped) {
      return;
    }
    this.kernelBootstrapped = true;
    this.runtimeRegistry.register({
      kind: "native",
      label: "Native",
      createRuntime: createNativeRuntimeFactory(
        this.params,
        this.mcpRuntimeSupport.toolRegistryAdapter,
        this.assetStore,
        this.sessionCreationService,
        this.sessionRequestBroker,
        this.sessionSearchRuntimeSupport,
      ),
    });
    const builtinNarpRegistrationService = new BuiltinNarpRuntimeRegistrationService(this.params.getConfig);
    this.builtinNarpRegistrations = builtinNarpRegistrationService.registerInto(this.runtimeRegistry);
    this.pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations();
    this.refreshConfiguredRuntimeEntries();
  }

  private runDerivedCapabilityWarmup = async (): Promise<void> => {
    const [, mcpWarmResults] = await Promise.all([
      this.sessionSearchRuntimeSupport.initialize(),
      this.mcpRuntimeSupport.prewarmEnabledServers(),
    ]);
    for (const result of mcpWarmResults) {
      if (!result.ok) {
        console.warn(`[mcp] Failed to warm ${result.name}: ${result.error}`);
      }
    }
  };

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("UI NCP agent runtime has already been disposed.");
    }
  }
}

export async function createUiNcpAgent(params: CreateUiNcpAgentParams): Promise<UiNcpAgentHandle> {
  const runtime = new UiNcpAgentRuntimeService(params);
  try {
    await runtime.bootstrapKernel();
    await runtime.recoverDurableState();
    await runtime.warmDerivedCapabilities();
    const handle = runtime.getHandle();
    if (!handle) {
      throw new Error("UI NCP agent kernel finished bootstrapping without exposing a handle.");
    }
    return handle;
  } catch (error) {
    await runtime.dispose().catch(() => undefined);
    throw error;
  }
}

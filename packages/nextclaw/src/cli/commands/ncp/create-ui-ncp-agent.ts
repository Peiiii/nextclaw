import {
  type Config,
  type CronService,
  DisposableStore,
  type GatewayController,
  getDataDir,
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
import { createAssetTools } from "./ncp-asset-tools.js";
import { NextclawNcpContextBuilder } from "./nextclaw-ncp-context-builder.js";
import { NextclawAgentSessionStore } from "./nextclaw-agent-session-store.js";
import { NextclawNcpToolRegistry } from "./nextclaw-ncp-tool-registry.js";
import { ProviderManagerNcpLLMApi } from "./provider-manager-ncp-llm-api.js";
import { SessionCreationService } from "./session-request/session-creation.service.js";
import { SessionRequestBroker } from "./session-request/session-request-broker.js";
import { SessionRequestDeliveryService } from "./session-request/session-request-delivery.service.js";
import { UiNcpRuntimeRegistry } from "./ui-ncp-runtime-registry.js";
import {
  createUiNcpAgentHandle,
  type UiNcpAgentHandle,
} from "./ui-ncp-agent-handle.js";
import { join } from "node:path";

const CODEX_RUNTIME_KIND = "codex";
const CODEX_DIRECT_RUNTIME_BACKEND = "codex-sdk";
export type { UiNcpAgentHandle } from "./ui-ncp-agent-handle.js";
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
};
type RuntimeFactory = (runtimeParams: RuntimeFactoryParams) => NcpAgentRuntime;
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decorateCodexRuntimeFactoryParams(
  runtimeParams: RuntimeFactoryParams,
  backend: string,
): RuntimeFactoryParams {
  const nextSessionMetadata = {
    ...runtimeParams.sessionMetadata,
    session_type: CODEX_RUNTIME_KIND,
    codex_runtime_backend: backend,
  };
  const setSessionMetadata = (nextMetadata: Record<string, unknown>) => {
    runtimeParams.setSessionMetadata({
      ...nextMetadata,
      session_type: CODEX_RUNTIME_KIND,
      codex_runtime_backend: backend,
    });
  };
  setSessionMetadata(nextSessionMetadata);
  return {
    ...runtimeParams,
    sessionMetadata: nextSessionMetadata,
    setSessionMetadata,
  };
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

function buildPluginRuntimeSnapshotKey(extensionRegistry?: NextclawExtensionRegistry): string {
  const registrations = extensionRegistry?.ncpAgentRuntimes ?? [];
  return registrations
    .map((registration) => [
      registration.pluginId,
      registration.kind,
      registration.label,
      registration.source,
    ].join(":"))
    .join("|");
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
): RuntimeFactory {
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
      providerManager: params.providerManager,
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
      llmApi: new ProviderManagerNcpLLMApi(params.providerManager),
      toolRegistry,
      stateManager,
      reasoningNormalizationMode,
    });
  };
}

function createCodexAwareRuntimeFactory(params: {
  registration: NextclawExtensionRegistry["ncpAgentRuntimes"][number];
}): RuntimeFactory {
  return (runtimeParams) => {
    const decoratedRuntimeParams = decorateCodexRuntimeFactoryParams(
      runtimeParams,
      CODEX_DIRECT_RUNTIME_BACKEND,
    );
    return params.registration.createRuntime(decoratedRuntimeParams);
  };
}

function resolveRegisteredRuntimeFactory(params: {
  registration: NextclawExtensionRegistry["ncpAgentRuntimes"][number];
}): RuntimeFactory {
  return params.registration.kind === CODEX_RUNTIME_KIND
    ? createCodexAwareRuntimeFactory(params)
    : params.registration.createRuntime;
}

class PluginRuntimeRegistrationController {
  private readonly pluginRuntimeScopes = new Map<string, DisposableStore>();
  private pluginRuntimeSnapshotKey = "";
  private activeExtensionRegistry: NextclawExtensionRegistry | undefined;

  constructor(
    private readonly runtimeRegistry: UiNcpRuntimeRegistry,
    private readonly getExtensionRegistry?: () => NextclawExtensionRegistry | undefined,
  ) {}

  private syncPluginRuntimeRegistrations = (extensionRegistry?: NextclawExtensionRegistry): void => {
    const nextSnapshotKey = buildPluginRuntimeSnapshotKey(extensionRegistry);
    if (nextSnapshotKey === this.pluginRuntimeSnapshotKey) {
      return;
    }

    this.pluginRuntimeSnapshotKey = nextSnapshotKey;
    for (const scope of this.pluginRuntimeScopes.values()) {
      scope.dispose();
    }
    this.pluginRuntimeScopes.clear();

    for (const registration of extensionRegistry?.ncpAgentRuntimes ?? []) {
      const pluginId = registration.pluginId.trim() || registration.kind;
      const scope = this.pluginRuntimeScopes.get(pluginId) ?? new DisposableStore();
      this.pluginRuntimeScopes.set(pluginId, scope);
      scope.add(this.runtimeRegistry.register({
        kind: registration.kind,
        label: registration.label,
        createRuntime: resolveRegisteredRuntimeFactory({
          registration,
        }),
        describeSessionType: registration.describeSessionType,
      }));
    }
  };

  private resolveActiveExtensionRegistry = (): NextclawExtensionRegistry | undefined =>
    this.activeExtensionRegistry ?? this.getExtensionRegistry?.();

  refreshPluginRuntimeRegistrations = (): void => {
    this.syncPluginRuntimeRegistrations(this.resolveActiveExtensionRegistry());
  };

  applyExtensionRegistry = (extensionRegistry?: NextclawExtensionRegistry): void => {
    this.activeExtensionRegistry = extensionRegistry;
    this.syncPluginRuntimeRegistrations(extensionRegistry);
  };

  dispose = (): void => {
    for (const scope of this.pluginRuntimeScopes.values()) {
      scope.dispose();
    }
    this.pluginRuntimeScopes.clear();
    this.activeExtensionRegistry = undefined;
    this.pluginRuntimeSnapshotKey = "";
  };
}

export async function createUiNcpAgent(params: CreateUiNcpAgentParams): Promise<UiNcpAgentHandle> {
  const sessionStore = new NextclawAgentSessionStore(params.sessionManager, {
    onSessionUpdated: params.onSessionUpdated,
  });
  const runtimeRegistry = new UiNcpRuntimeRegistry();
  const { toolRegistryAdapter, applyMcpConfig, dispose: disposeMcpRuntimeSupport } =
    await createMcpRuntimeSupport(params.getConfig);
  const assetStore = new LocalAssetStore({
    rootDir: join(getDataDir(), "assets"),
  });
  let backend: DefaultNcpAgentBackend | null = null;
  const sessionCreationService = new SessionCreationService(
    params.sessionManager,
    params.getConfig,
    params.onSessionUpdated,
  );
  const sessionRequestBroker = new SessionRequestBroker(
    params.sessionManager,
    sessionCreationService,
    new SessionRequestDeliveryService(() => backend),
    () => backend,
    params.onSessionUpdated,
  );
  const createNativeRuntime = createNativeRuntimeFactory(
    params,
    toolRegistryAdapter,
    assetStore,
    sessionCreationService,
    sessionRequestBroker,
  );

  runtimeRegistry.register({
    kind: "native",
    label: "Native",
    createRuntime: createNativeRuntime,
  });

  const pluginRuntimeRegistrationController = new PluginRuntimeRegistrationController(
    runtimeRegistry,
    params.getExtensionRegistry,
  );
  pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations();

  backend = new DefaultNcpAgentBackend({
    endpointId: "nextclaw-ui-agent",
    sessionStore,
    onSessionRunStatusChanged: params.onSessionRunStatusChanged,
    createRuntime: (runtimeParams) => {
      pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations();
      return runtimeRegistry.createRuntime(runtimeParams);
    },
  });

  await backend.start();

  return createUiNcpAgentHandle({
    backend,
    runtimeRegistry,
    refreshPluginRuntimeRegistrations:
      pluginRuntimeRegistrationController.refreshPluginRuntimeRegistrations,
    applyExtensionRegistry: pluginRuntimeRegistrationController.applyExtensionRegistry,
    applyMcpConfig,
    dispose: async () => {
      pluginRuntimeRegistrationController.dispose();
      await backend?.stop();
      await disposeMcpRuntimeSupport();
    },
    assetStore,
  });
}

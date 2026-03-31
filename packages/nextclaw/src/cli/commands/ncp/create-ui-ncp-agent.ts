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
  type NcpSessionApi,
  readAssistantReasoningNormalizationMode,
  readAssistantReasoningNormalizationModeFromMetadata,
  writeAssistantReasoningNormalizationModeToMetadata,
  type NcpAssistantReasoningNormalizationMode,
} from "@nextclaw/ncp";
import {
  createAgentClientFromServer,
  DefaultNcpAgentBackend,
  type RuntimeFactoryParams,
} from "@nextclaw/ncp-toolkit";
import type { UiNcpAgent } from "@nextclaw/server";
import type { NextclawExtensionRegistry } from "../plugins.js";
import { createAssetTools } from "./ncp-asset-tools.js";
import { NextclawNcpContextBuilder } from "./nextclaw-ncp-context-builder.js";
import { NextclawAgentSessionStore } from "./nextclaw-agent-session-store.js";
import { persistSubagentCompletionAndResumeParent } from "./ncp-subagent-completion-follow-up.js";
import { NextclawNcpToolRegistry } from "./nextclaw-ncp-tool-registry.js";
import { ProviderManagerNcpLLMApi } from "./provider-manager-ncp-llm-api.js";
import {
  UiNcpRuntimeRegistry,
  type UiNcpSessionTypeDescribeParams,
} from "./ui-ncp-runtime-registry.js";
import { join } from "node:path";

const CODEX_RUNTIME_KIND = "codex";
const CODEX_DIRECT_RUNTIME_BACKEND = "codex-sdk";
export type UiNcpAgentHandle = UiNcpAgent & {
  sessionApi: NcpSessionApi;
  applyExtensionRegistry?: (extensionRegistry?: NextclawExtensionRegistry) => void;
  applyMcpConfig?: (config: Config) => Promise<void>;
};
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
  };
}

function createNativeRuntimeFactory(
  params: CreateUiNcpAgentParams,
  mcpToolRegistryAdapter: McpNcpToolRegistryAdapter,
  assetStore: LocalAssetStore,
  resolveBackend: () => DefaultNcpAgentBackend | null,
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
      writeSubagentCompletionToSession: async (completion) => {
        const backend = resolveBackend();
        if (!backend) {
          throw new Error("NCP backend is not ready for subagent completion persistence.");
        }
        await persistSubagentCompletionAndResumeParent({
          backend,
          completion: {
            sessionId: completion.sessionId,
            runId: completion.runId,
            toolCallId: completion.toolCallId,
            label: completion.label,
            task: completion.task,
            result: completion.result,
            status: completion.status,
          },
        });
      },
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

function createPluginRuntimeRegistrationController(params: {
  runtimeRegistry: UiNcpRuntimeRegistry;
  getConfig: () => Config;
  getExtensionRegistry?: () => NextclawExtensionRegistry | undefined;
  createNativeRuntime: RuntimeFactory;
}) {
  const pluginRuntimeScopes = new Map<string, DisposableStore>();
  let pluginRuntimeSnapshotKey = "";
  let activeExtensionRegistry: NextclawExtensionRegistry | undefined;

  const syncPluginRuntimeRegistrations = (extensionRegistry?: NextclawExtensionRegistry): void => {
    const nextSnapshotKey = buildPluginRuntimeSnapshotKey(extensionRegistry);
    if (nextSnapshotKey === pluginRuntimeSnapshotKey) {
      return;
    }

    pluginRuntimeSnapshotKey = nextSnapshotKey;
    for (const scope of pluginRuntimeScopes.values()) {
      scope.dispose();
    }
    pluginRuntimeScopes.clear();

    for (const registration of extensionRegistry?.ncpAgentRuntimes ?? []) {
      const pluginId = registration.pluginId.trim() || registration.kind;
      const scope = pluginRuntimeScopes.get(pluginId) ?? new DisposableStore();
      pluginRuntimeScopes.set(pluginId, scope);
      scope.add(params.runtimeRegistry.register({
        kind: registration.kind,
        label: registration.label,
        createRuntime: resolveRegisteredRuntimeFactory({
          registration,
        }),
        describeSessionType: registration.describeSessionType,
      }));
    }
  };

  const resolveActiveExtensionRegistry = (): NextclawExtensionRegistry | undefined =>
    activeExtensionRegistry ?? params.getExtensionRegistry?.();

  return {
    refreshPluginRuntimeRegistrations: (): void => {
      syncPluginRuntimeRegistrations(resolveActiveExtensionRegistry());
    },
    applyExtensionRegistry: (extensionRegistry?: NextclawExtensionRegistry): void => {
      activeExtensionRegistry = extensionRegistry;
      syncPluginRuntimeRegistrations(extensionRegistry);
    },
  };
}

function createUiNcpAgentHandle(params: {
  backend: DefaultNcpAgentBackend;
  runtimeRegistry: UiNcpRuntimeRegistry;
  refreshPluginRuntimeRegistrations: () => void;
  applyExtensionRegistry: (extensionRegistry?: NextclawExtensionRegistry) => void;
  applyMcpConfig: (config: Config) => Promise<void>;
  assetStore: LocalAssetStore;
}): UiNcpAgentHandle {
  return {
    basePath: "/api/ncp/agent",
    agentClientEndpoint: createAgentClientFromServer(params.backend),
    streamProvider: params.backend,
    sessionApi: params.backend,
    listSessionTypes: (describeParams?: UiNcpSessionTypeDescribeParams) => {
      params.refreshPluginRuntimeRegistrations();
      return params.runtimeRegistry.listSessionTypes(describeParams);
    },
    assetApi: {
      put: (input) =>
        params.assetStore.putBytes({
          fileName: input.fileName,
          mimeType: input.mimeType,
          bytes: input.bytes,
          createdAt: input.createdAt,
        }),
      stat: (uri) => params.assetStore.statRecord(uri),
      resolveContentPath: (uri) => params.assetStore.resolveContentPath(uri),
    },
    applyExtensionRegistry: params.applyExtensionRegistry,
    applyMcpConfig: params.applyMcpConfig,
  };
}

export async function createUiNcpAgent(params: CreateUiNcpAgentParams): Promise<UiNcpAgentHandle> {
  const sessionStore = new NextclawAgentSessionStore(params.sessionManager, {
    onSessionUpdated: params.onSessionUpdated,
  });
  const runtimeRegistry = new UiNcpRuntimeRegistry();
  const { toolRegistryAdapter, applyMcpConfig } = await createMcpRuntimeSupport(params.getConfig);
  const assetStore = new LocalAssetStore({
    rootDir: join(getDataDir(), "assets"),
  });
  let backend: DefaultNcpAgentBackend | null = null;
  const createNativeRuntime = createNativeRuntimeFactory(
    params,
    toolRegistryAdapter,
    assetStore,
    () => backend,
  );

  runtimeRegistry.register({
    kind: "native",
    label: "Native",
    createRuntime: createNativeRuntime,
  });

  const pluginRuntimeRegistrationController = createPluginRuntimeRegistrationController({
    runtimeRegistry,
    getConfig: params.getConfig,
    getExtensionRegistry: params.getExtensionRegistry,
    createNativeRuntime,
  });
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
    assetStore,
  });
}

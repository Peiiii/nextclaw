import * as NextclawCore from "@nextclaw/core";
import {
  getPluginUiMetadataFromRegistry,
  startPluginChannelGateways,
  type PluginChannelBinding,
  type PluginRegistry,
  type PluginUiMetadata,
} from "@nextclaw/openclaw-compat";
import type { UiNcpAgentHandle } from "@nextclaw-service/commands/ncp/features/runtime/create-ui-ncp-agent.service.js";
import { dispatchPromptOverNcp } from "@nextclaw-service/commands/ncp/features/runtime/nextclaw-ncp-dispatch.js";
import {
  applyGatewayCapabilityState,
  type GatewayCapabilityState,
  type GatewayStartupContext
} from "@nextclaw-service/shared/services/gateway/service-gateway-context.service.js";
import type { UiStartupHandle } from "@nextclaw-service/shared/services/gateway/service-gateway-startup.service.js";
import { ServiceBootstrapStatusStore } from "@nextclaw-service/shared/services/gateway/service-bootstrap-status.js";
import { hydrateServiceCapabilities } from "@nextclaw-service/shared/services/gateway/service-capability-hydration.service.js";
import { installPluginRuntimeBridge } from "@nextclaw-service/shared/services/plugin/service-plugin-runtime-bridge.service.js";
import { reloadServicePlugins } from "@nextclaw-service/shared/services/plugin/service-plugin-reload.service.js";
import { logPluginGatewayDiagnostics, pluginGatewayLogger } from "@nextclaw-service/shared/services/gateway/service-startup-support.js";
import type { NextclawExtensionRegistry } from "@nextclaw-service/commands/plugin/index.js";

const { loadConfig, resolveConfigSecrets } = NextclawCore;

type PluginGatewayHandles = Awaited<ReturnType<typeof startPluginChannelGateways>>["handles"];

export type GatewayRuntimeState = {
  pluginRegistry: PluginRegistry;
  extensionRegistry: NextclawExtensionRegistry;
  pluginChannelBindings: PluginChannelBinding[];
  pluginUiMetadata: PluginUiMetadata[];
  pluginGatewayHandles: PluginGatewayHandles;
};

export function createBootstrapStatus(remoteEnabled: boolean): ServiceBootstrapStatusStore {
  const bootstrapStatus = new ServiceBootstrapStatusStore();
  bootstrapStatus.markNcpAgentPending();
  bootstrapStatus.markPluginHydrationPending();
  bootstrapStatus.markChannelsPending();
  bootstrapStatus.setRemoteState(remoteEnabled ? "pending" : "disabled");
  return bootstrapStatus;
}

export function createGatewayRuntimeState(gateway: GatewayStartupContext): GatewayRuntimeState {
  return {
    pluginRegistry: gateway.pluginRegistry,
    extensionRegistry: gateway.extensionRegistry,
    pluginChannelBindings: gateway.pluginChannelBindings,
    pluginUiMetadata: getPluginUiMetadataFromRegistry(gateway.pluginRegistry),
    pluginGatewayHandles: []
  };
}

function applyGatewayRuntimeCapabilityState(params: {
  gateway: GatewayStartupContext;
  state: GatewayRuntimeState;
  next: GatewayCapabilityState;
}): void {
  applyGatewayCapabilityState(params.gateway, params.next);
  params.state.pluginRegistry = params.next.pluginRegistry;
  params.state.extensionRegistry = params.next.extensionRegistry;
  params.state.pluginChannelBindings = params.next.pluginChannelBindings;
}

async function applyGatewayPluginReload(params: {
  gateway: GatewayStartupContext;
  state: GatewayRuntimeState;
  getLiveUiNcpAgent: () => UiNcpAgentHandle | null;
  nextConfig: NextclawCore.Config;
  changedPaths: string[];
}): Promise<{ restartChannels: boolean }> {
  const result = await reloadServicePlugins({
    nextConfig: params.nextConfig,
    changedPaths: params.changedPaths,
    pluginRegistry: params.state.pluginRegistry,
    extensionRegistry: params.state.extensionRegistry,
    pluginChannelBindings: params.state.pluginChannelBindings,
    pluginGatewayHandles: params.state.pluginGatewayHandles,
    pluginGatewayLogger,
    logPluginGatewayDiagnostics,
  });
  applyGatewayRuntimeCapabilityState({
    gateway: params.gateway,
    state: params.state,
    next: {
      pluginRegistry: result.pluginRegistry,
      extensionRegistry: result.extensionRegistry,
      pluginChannelBindings: result.pluginChannelBindings,
    },
  });
  params.state.pluginUiMetadata = getPluginUiMetadataFromRegistry(result.pluginRegistry);
  params.state.pluginGatewayHandles = result.pluginGatewayHandles;
  params.getLiveUiNcpAgent()?.applyExtensionRegistry?.(result.extensionRegistry);
  return { restartChannels: result.restartChannels };
}

export async function reloadGatewayPluginRuntimeForChanges(params: {
  gateway: GatewayStartupContext;
  state: GatewayRuntimeState;
  getLiveUiNcpAgent: () => UiNcpAgentHandle | null;
  changedPaths: string[];
}): Promise<{ restartChannels: boolean }> {
  const nextConfig = resolveConfigSecrets(loadConfig(), {
    configPath: params.gateway.runtimeConfigPath,
  });
  const result = await applyGatewayPluginReload({
    gateway: params.gateway,
    state: params.state,
    getLiveUiNcpAgent: params.getLiveUiNcpAgent,
    nextConfig,
    changedPaths: params.changedPaths,
  });
  if (result.restartChannels) {
    await params.gateway.reloader.rebuildChannels(nextConfig, { start: true });
  }
  return result;
}

export function configureGatewayPluginRuntime(params: {
  gateway: GatewayStartupContext;
  state: GatewayRuntimeState;
  getLiveUiNcpAgent: () => UiNcpAgentHandle | null;
}): void {
  params.gateway.reloader.setReloadPlugins(async ({ config: nextConfig, changedPaths }) => {
    const result = await applyGatewayPluginReload({
      gateway: params.gateway,
      state: params.state,
      getLiveUiNcpAgent: params.getLiveUiNcpAgent,
      nextConfig,
      changedPaths,
    });
    if (result.restartChannels) {
      console.log("Config reload: plugin channel gateways restarted.");
    }
    return { restartChannels: result.restartChannels };
  });
  params.gateway.reloader.setReloadMcp(async ({ config: nextConfig }) => {
    await params.getLiveUiNcpAgent()?.applyMcpConfig?.(nextConfig);
  });

  installPluginRuntimeBridge({
    dispatchPrompt: async (request) =>
      await dispatchPromptOverNcp({
        config: resolveConfigSecrets(loadConfig(), {
          configPath: params.gateway.runtimeConfigPath,
        }),
        sessionManager: params.gateway.sessionManager,
        resolveNcpAgent: () => params.getLiveUiNcpAgent(),
        ...request,
      }),
    runtimeConfigPath: params.gateway.runtimeConfigPath,
    getPluginChannelBindings: () => params.state.pluginChannelBindings
  });
}

export function createDeferredGatewayStartupHooks(params: {
  uiStartup: UiStartupHandle | null;
  gateway: GatewayStartupContext;
  state: GatewayRuntimeState;
  bootstrapStatus: ServiceBootstrapStatusStore;
  getLiveUiNcpAgent: () => UiNcpAgentHandle | null;
  setLiveUiNcpAgent: (agent: UiNcpAgentHandle) => void;
  wakeFromRestartSentinel: () => Promise<void>;
}) {
  return {
    hydrateCapabilities: async () => {
      await hydrateServiceCapabilities({
        uiStartup: params.uiStartup,
        gateway: params.gateway,
        state: params.state,
        bootstrapStatus: params.bootstrapStatus,
        getLiveUiNcpAgent: params.getLiveUiNcpAgent
      });
    },
    startPluginGateways: async () => {
      const startedPluginGateways = await startPluginChannelGateways({
        registry: params.state.pluginRegistry,
        config: resolveConfigSecrets(loadConfig(), { configPath: params.gateway.runtimeConfigPath }),
        logger: pluginGatewayLogger
      });
      params.state.pluginGatewayHandles = startedPluginGateways.handles;
      logPluginGatewayDiagnostics(startedPluginGateways.diagnostics);
    },
    startChannels: async () => {
      await params.gateway.reloader.getChannels().startAll();
      const enabledChannels = params.gateway.reloader.getChannels().enabledChannels;
      if (enabledChannels.length > 0) {
        console.log(`✓ Channels enabled: ${enabledChannels.join(", ")}`);
      } else {
        console.log("Warning: No channels enabled");
      }
      params.bootstrapStatus.markChannelsReady(enabledChannels);
      params.bootstrapStatus.markReady();
    },
    wakeFromRestartSentinel: params.wakeFromRestartSentinel,
    onNcpAgentReady: (ncpAgent: UiNcpAgentHandle) => {
      params.setLiveUiNcpAgent(ncpAgent);
    }
  };
}

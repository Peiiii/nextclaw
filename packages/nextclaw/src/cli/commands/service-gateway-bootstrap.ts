import * as NextclawCore from "@nextclaw/core";
import {
  getPluginUiMetadataFromRegistry,
  startPluginChannelGateways,
  type PluginChannelBinding,
  type PluginRegistry,
  type PluginUiMetadata,
} from "@nextclaw/openclaw-compat";
import type { UiNcpAgentHandle } from "./ncp/create-ui-ncp-agent.js";
import type { GatewayStartupContext } from "./service-gateway-context.js";
import type { UiStartupHandle } from "./service-gateway-startup.js";
import { ServiceBootstrapStatusStore } from "./service-bootstrap-status.js";
import { hydrateServiceCapabilities } from "./service-capability-hydration.js";
import { installPluginRuntimeBridge } from "./service-plugin-runtime-bridge.js";
import { reloadServicePlugins } from "./service-plugin-reload.js";
import { logPluginGatewayDiagnostics, pluginGatewayLogger } from "./service-startup-support.js";
import type { NextclawExtensionRegistry } from "./plugins.js";

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

export function configureGatewayPluginRuntime(params: {
  gateway: GatewayStartupContext;
  state: GatewayRuntimeState;
  getLiveUiNcpAgent: () => UiNcpAgentHandle | null;
}): void {
  params.gateway.reloader.setApplyAgentRuntimeConfig((nextConfig) => params.gateway.runtimePool.applyRuntimeConfig(nextConfig));
  params.gateway.reloader.setReloadPlugins(async ({ config: nextConfig, changedPaths }) => {
    const result = await reloadServicePlugins({
      nextConfig,
      changedPaths,
      pluginRegistry: params.state.pluginRegistry,
      extensionRegistry: params.state.extensionRegistry,
      pluginChannelBindings: params.state.pluginChannelBindings,
      pluginGatewayHandles: params.state.pluginGatewayHandles,
      pluginGatewayLogger,
      logPluginGatewayDiagnostics,
    });
    params.state.pluginRegistry = result.pluginRegistry;
    params.state.extensionRegistry = result.extensionRegistry;
    params.state.pluginChannelBindings = result.pluginChannelBindings;
    params.state.pluginUiMetadata = getPluginUiMetadataFromRegistry(result.pluginRegistry);
    params.state.pluginGatewayHandles = result.pluginGatewayHandles;
    params.gateway.runtimePool.applyExtensionRegistry(result.extensionRegistry);
    params.getLiveUiNcpAgent()?.applyExtensionRegistry?.(result.extensionRegistry);
    params.gateway.runtimePool.applyRuntimeConfig(nextConfig);
    if (result.restartChannels) {
      console.log("Config reload: plugin channel gateways restarted.");
    }
    return { restartChannels: result.restartChannels };
  });
  params.gateway.reloader.setReloadMcp(async ({ config: nextConfig }) => {
    await params.getLiveUiNcpAgent()?.applyMcpConfig?.(nextConfig);
  });

  installPluginRuntimeBridge({
    runtimePool: params.gateway.runtimePool,
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

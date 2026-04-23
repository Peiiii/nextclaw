import * as NextclawCore from "@nextclaw/core";
import {
  getPluginUiMetadataFromRegistry,
  startPluginChannelGateways,
  type PluginChannelBinding,
  type PluginRegistry,
  type PluginUiMetadata,
} from "@nextclaw/openclaw-compat";
import type { UiNcpAgentHandle } from "@/cli/commands/ncp/features/runtime/create-ui-ncp-agent.service.js";
import { dispatchPromptOverNcp } from "@/cli/commands/ncp/features/runtime/nextclaw-ncp-dispatch.js";
import {
  applyGatewayCapabilityState,
  type GatewayCapabilityState,
  type GatewayStartupContext
} from "@/cli/shared/services/gateway/service-gateway-context.service.js";
import type { UiStartupHandle } from "@/cli/shared/services/gateway/service-gateway-startup.service.js";
import { ServiceBootstrapStatusStore } from "@/cli/shared/services/gateway/service-bootstrap-status.service.js";
import { hydrateServiceCapabilities } from "@/cli/shared/services/gateway/service-capability-hydration.service.js";
import { installPluginRuntimeBridge } from "@/cli/shared/services/plugin/service-plugin-runtime-bridge.service.js";
import { reloadServicePlugins } from "@/cli/shared/services/plugin/service-plugin-reload.service.js";
import { logPluginGatewayDiagnostics, pluginGatewayLogger } from "@/cli/shared/services/gateway/service-startup-support.js";
import type { NextclawExtensionRegistry } from "@/cli/commands/plugin/index.js";

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

export function configureGatewayPluginRuntime(params: {
  gateway: GatewayStartupContext;
  state: GatewayRuntimeState;
  getLiveUiNcpAgent: () => UiNcpAgentHandle | null;
}): void {
  params.gateway.reloader.setReloadPlugins(async ({ config: nextConfig, changedPaths }) => {
    const result = await reloadServicePlugins({
      nextConfig,
      changedPaths,
      pluginRegistry: params.state.pluginRegistry,
      extensionRegistry: params.state.extensionRegistry,
      pluginChannelBindings: params.state.pluginChannelBindings,
      pluginGatewayHandles: params.state.pluginGatewayHandles,
      pluginGatewayLogger,
      logPluginGatewayDiagnostics
    });
    applyGatewayRuntimeCapabilityState({
      gateway: params.gateway,
      state: params.state,
      next: {
        pluginRegistry: result.pluginRegistry,
        extensionRegistry: result.extensionRegistry,
        pluginChannelBindings: result.pluginChannelBindings
      }
    });
    params.state.pluginUiMetadata = getPluginUiMetadataFromRegistry(result.pluginRegistry);
    params.state.pluginGatewayHandles = result.pluginGatewayHandles;
    params.getLiveUiNcpAgent()?.applyExtensionRegistry?.(result.extensionRegistry);
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

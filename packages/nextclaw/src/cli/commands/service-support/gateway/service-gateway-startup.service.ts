import type * as NextclawCore from "@nextclaw/core";
import type { PluginChannelBinding, PluginUiMetadata } from "@nextclaw/openclaw-compat";
import {
  startUiServer,
  type BootstrapStatusView,
  type MarketplaceApiConfig,
  type UiNcpSessionService,
  type UiRuntimeControlHost,
  type UiServerEvent,
  type UiRemoteAccessHost
} from "@nextclaw/server";
import { openBrowser } from "../../../shared/utils/cli.utils.js";
import type { GatewayControllerImpl } from "../../../shared/controllers/gateway.controller.js";
import type { UiNcpAgentHandle } from "../../ncp/features/runtime/create-ui-ncp-agent.service.js";
import { runGatewayInboundLoop } from "../../ncp/features/runtime/nextclaw-ncp-dispatch.js";
import type { NextclawExtensionRegistry } from "../../plugin/index.js";
import { createDeferredUiNcpAgent, type DeferredUiNcpAgentController } from "../session/service-deferred-ncp-agent.service.js";
import type { DeferredUiNcpSessionServiceController } from "../session/service-deferred-ncp-session-service.js";
import { logStartupTrace } from "../../../shared/utils/startup-trace.js";
import type { ConfigReloader } from "../../../shared/services/config-reloader.service.js";
import type { ServiceBootstrapStatusStore } from "./service-bootstrap-status.js";
import { NextclawApp } from "./nextclaw-app.service.js";

type Config = NextclawCore.Config;
type MessageBus = NextclawCore.MessageBus;
type SessionManager = NextclawCore.SessionManager;
type ProviderManager = NextclawCore.ProviderManager;
type CronService = NextclawCore.CronService;

export type UiStartupHandle = {
  deferredNcpAgent: DeferredUiNcpAgentController;
  publish: (event: UiServerEvent) => void;
};

export function createSystemSessionUpdatedPublisher(params: {
  publishUiEvent?: (event: UiServerEvent) => void;
}): (params: { sessionKey: string }) => void {
  return ({ sessionKey }) => {
    params.publishUiEvent?.({
      type: "session.updated",
      payload: { sessionKey }
    });
  };
}

export async function startUiShell(params: {
  uiConfig: Config["ui"];
  uiStaticDir: string | null;
  cronService: CronService;
  getConfig: () => Config;
  configPath: string;
  productVersion: string;
  getPluginChannelBindings: () => PluginChannelBinding[];
  getPluginUiMetadata: () => PluginUiMetadata[];
  marketplace: MarketplaceApiConfig;
  remoteAccess: UiRemoteAccessHost;
  runtimeControl: UiRuntimeControlHost;
  getBootstrapStatus?: () => BootstrapStatusView;
  openBrowserWindow: boolean;
  applyLiveConfigReload?: () => Promise<void>;
  ncpSessionService?: UiNcpSessionService;
  initializeAgentHomeDirectory?: (homeDirectory: string) => void;
}): Promise<UiStartupHandle | null> {
  logStartupTrace("service.start_ui_shell.begin");
  const {
    applyLiveConfigReload,
    configPath,
    cronService,
    getBootstrapStatus,
    getPluginChannelBindings,
    getPluginUiMetadata,
    initializeAgentHomeDirectory,
    marketplace,
    ncpSessionService,
    openBrowserWindow,
    productVersion,
    remoteAccess,
    runtimeControl,
    uiConfig,
    uiStaticDir,
  } = params;
  if (!uiConfig.enabled) {
    return null;
  }

  let publishUiEvent: ((event: UiServerEvent) => void) | null = null;
  const deferredNcpAgent = createDeferredUiNcpAgent();
  const uiServer = startUiServer({
    host: uiConfig.host,
    port: uiConfig.port,
    configPath,
    productVersion,
    staticDir: uiStaticDir ?? undefined,
    applyLiveConfigReload,
    initializeAgentHomeDirectory,
    cronService,
    marketplace,
    remoteAccess,
    runtimeControl,
    getBootstrapStatus,
    getPluginChannelBindings,
    getPluginUiMetadata,
    ncpSessionService,
    ncpAgent: deferredNcpAgent.agent,
  });
  publishUiEvent = uiServer.publish;
  const uiUrl = `http://${uiServer.host}:${uiServer.port}`;
  console.log(`✓ UI API: ${uiUrl}/api`);
  if (uiStaticDir) {
    console.log(`✓ UI frontend: ${uiUrl}`);
  }
  if (openBrowserWindow) {
    openBrowser(uiUrl);
  }

  logStartupTrace("service.start_ui_shell.ready", {
    host: uiServer.host,
    port: uiServer.port
  });

  return {
    deferredNcpAgent,
    publish: (event) => {
      publishUiEvent?.(event);
    }
  };
}

export async function startDeferredGatewayStartup(params: {
  bootstrapStatus: ServiceBootstrapStatusStore;
  uiStartup: UiStartupHandle | null;
  deferredNcpSessionService: DeferredUiNcpSessionServiceController;
  bus: MessageBus;
  sessionManager: SessionManager;
  providerManager: ProviderManager;
  cronService: CronService;
  gatewayController: GatewayControllerImpl;
  getConfig: () => Config;
  getExtensionRegistry: () => NextclawExtensionRegistry | undefined;
  resolveMessageToolHints: (params: { channel: string; accountId?: string | null }) => string[];
  hydrateCapabilities?: () => Promise<void>;
  startPluginGateways: () => Promise<void>;
  startChannels: () => Promise<void>;
  wakeFromRestartSentinel: () => Promise<void>;
  onNcpAgentReady: (agent: UiNcpAgentHandle) => void;
  publishSessionChange: (sessionKey: string) => void;
}): Promise<void> {
  const app = new NextclawApp(params);
  await app.start();
}

export async function runGatewayRuntimeLoop(params: {
  runRuntimeLoop: () => Promise<void>;
  startDeferredStartup: () => Promise<void>;
  onDeferredStartupError: (error: unknown) => void;
  cleanup: () => Promise<void>;
}): Promise<void> {
  const {
    cleanup,
    onDeferredStartupError,
    runRuntimeLoop,
    startDeferredStartup,
  } = params;
  let startupTask: Promise<void> | null = null;
  try {
    const runtimeLoopTask = runRuntimeLoop();
    startupTask = startDeferredStartup();
    void startupTask.catch(onDeferredStartupError);
    await runtimeLoopTask;
  } finally {
    if (startupTask) {
      await startupTask.catch(() => undefined);
    }
    await cleanup();
  }
}

export async function runConfiguredGatewayRuntime(params: {
  uiStartup: UiStartupHandle | null;
  bootstrapStatus: ServiceBootstrapStatusStore;
  gateway: {
    bus: MessageBus;
    sessionManager: SessionManager;
    providerManager: ProviderManager;
    cron: CronService;
    gatewayController: GatewayControllerImpl;
    reloader: ConfigReloader;
    runtimeConfigPath: string;
  };
  deferredNcpSessionService: DeferredUiNcpSessionServiceController;
  getConfig: () => Config;
  getExtensionRegistry: () => NextclawExtensionRegistry | undefined;
  resolveMessageToolHints: (params: {
    channel: string;
    accountId?: string | null;
  }) => string[];
  deferredStartupHooks: {
    hydrateCapabilities?: () => Promise<void>;
    startPluginGateways: () => Promise<void>;
    startChannels: () => Promise<void>;
    wakeFromRestartSentinel: () => Promise<void>;
    onNcpAgentReady: (agent: UiNcpAgentHandle) => void;
  };
  getLiveUiNcpAgent: () => UiNcpAgentHandle | null;
  publishSessionChange: (sessionKey: string) => void;
  publishUiEvent?: (event: UiServerEvent) => void;
  onDeferredStartupError: (error: unknown) => void;
  cleanup: () => Promise<void>;
}): Promise<void> {
  const onSystemSessionUpdated = createSystemSessionUpdatedPublisher({
    publishUiEvent: params.publishUiEvent,
  });

  logStartupTrace("service.start_gateway.runtime_loop_begin");
  await runGatewayRuntimeLoop({
    runRuntimeLoop: () =>
      runGatewayInboundLoop({
        bus: params.gateway.bus,
        sessionManager: params.gateway.sessionManager,
        getConfig: params.getConfig,
        resolveNcpAgent: params.getLiveUiNcpAgent,
        getChannels: () => params.gateway.reloader.getChannels(),
        onSystemSessionUpdated: ({ sessionKey }) =>
          onSystemSessionUpdated({ sessionKey }),
      }),
    startDeferredStartup: () =>
      startDeferredGatewayStartup({
        bootstrapStatus: params.bootstrapStatus,
        uiStartup: params.uiStartup,
        deferredNcpSessionService: params.deferredNcpSessionService,
        bus: params.gateway.bus,
        sessionManager: params.gateway.sessionManager,
        providerManager: params.gateway.providerManager,
        cronService: params.gateway.cron,
        gatewayController: params.gateway.gatewayController,
        getConfig: params.getConfig,
        getExtensionRegistry: params.getExtensionRegistry,
        resolveMessageToolHints: params.resolveMessageToolHints,
        hydrateCapabilities: params.deferredStartupHooks.hydrateCapabilities,
        startPluginGateways: params.deferredStartupHooks.startPluginGateways,
        startChannels: params.deferredStartupHooks.startChannels,
        wakeFromRestartSentinel: params.deferredStartupHooks.wakeFromRestartSentinel,
        onNcpAgentReady: params.deferredStartupHooks.onNcpAgentReady,
        publishSessionChange: params.publishSessionChange,
      }),
    onDeferredStartupError: params.onDeferredStartupError,
    cleanup: params.cleanup,
  });
}

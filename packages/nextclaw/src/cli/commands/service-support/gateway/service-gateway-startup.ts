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
import { openBrowser } from "../../../utils.js";
import type { GatewayControllerImpl } from "../../../gateway/controller.js";
import { createUiNcpAgent, type UiNcpAgentHandle } from "../../ncp/create-ui-ncp-agent.service.js";
import { runGatewayInboundLoop } from "../../ncp/runtime/nextclaw-ncp-dispatch.js";
import { createChannelReplyRouterService } from "../../ncp/runtime/runner/channel-reply-router.service.js";
import type { NextclawExtensionRegistry } from "../../plugins.js";
import { createDeferredUiNcpAgent, type DeferredUiNcpAgentController } from "../session/service-deferred-ncp-agent.js";
import type { DeferredUiNcpSessionServiceController } from "../session/service-deferred-ncp-session-service.js";
import { logStartupTrace, measureStartupAsync } from "../../../startup-trace.js";
import type { ConfigReloader } from "../../../config-reloader.js";

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
  if (!params.uiConfig.enabled) {
    return null;
  }

  let publishUiEvent: ((event: UiServerEvent) => void) | null = null;
  const deferredNcpAgent = createDeferredUiNcpAgent();
  const uiServer = startUiServer({
    host: params.uiConfig.host,
    port: params.uiConfig.port,
    configPath: params.configPath,
    productVersion: params.productVersion,
    staticDir: params.uiStaticDir ?? undefined,
    applyLiveConfigReload: params.applyLiveConfigReload,
    initializeAgentHomeDirectory: params.initializeAgentHomeDirectory,
    cronService: params.cronService,
    marketplace: params.marketplace,
    remoteAccess: params.remoteAccess,
    runtimeControl: params.runtimeControl,
    getBootstrapStatus: params.getBootstrapStatus,
    getPluginChannelBindings: params.getPluginChannelBindings,
    getPluginUiMetadata: params.getPluginUiMetadata,
    ncpSessionService: params.ncpSessionService,
    ncpAgent: deferredNcpAgent.agent,
  });
  publishUiEvent = uiServer.publish;
  const uiUrl = `http://${uiServer.host}:${uiServer.port}`;
  console.log(`✓ UI API: ${uiUrl}/api`);
  if (params.uiStaticDir) {
    console.log(`✓ UI frontend: ${uiUrl}`);
  }
  if (params.openBrowserWindow) {
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
  const {
    uiStartup,
    deferredNcpSessionService,
    bus,
    sessionManager,
    providerManager,
    cronService,
    gatewayController,
    getConfig,
    getExtensionRegistry,
    resolveMessageToolHints,
    hydrateCapabilities,
    startPluginGateways,
    startChannels,
    wakeFromRestartSentinel,
    onNcpAgentReady,
    publishSessionChange,
  } = params;
  logStartupTrace("service.deferred_startup.begin");
  try {
    const ncpAgent = await measureStartupAsync("service.deferred_startup.create_ui_ncp_agent", async () =>
      await createUiNcpAgent({
        bus,
        providerManager,
        sessionManager,
        cronService,
        gatewayController,
        getConfig,
        getExtensionRegistry,
        onSessionUpdated: publishSessionChange,
        onSessionRunStatusChanged: (payload) => {
          uiStartup?.publish({
            type: "session.run-status",
            payload,
          });
        },
        resolveMessageToolHints: ({ channel, accountId }) =>
          resolveMessageToolHints({ channel, accountId }),
      })
    );
    deferredNcpSessionService.activate(ncpAgent.sessionApi);
    onNcpAgentReady(ncpAgent);
    if (uiStartup) {
      uiStartup.deferredNcpAgent.activate(ncpAgent);
      console.log("✓ UI NCP agent: ready");
    } else {
      console.log("✓ Service NCP agent: ready");
    }
  } catch (error) {
    console.error(`UI NCP agent startup failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (hydrateCapabilities) {
    await measureStartupAsync("service.deferred_startup.hydrate_capabilities", hydrateCapabilities);
  }
  await measureStartupAsync("service.deferred_startup.start_plugin_gateways", startPluginGateways);
  await measureStartupAsync("service.deferred_startup.start_channels", startChannels);
  await measureStartupAsync("service.deferred_startup.wake_restart_sentinel", wakeFromRestartSentinel);
  console.log("✓ Deferred startup: plugin gateways and channels settled");
  logStartupTrace("service.deferred_startup.end");
}

export async function runGatewayRuntimeLoop(params: {
  runRuntimeLoop: () => Promise<void>;
  startDeferredStartup: () => Promise<void>;
  onDeferredStartupError: (error: unknown) => void;
  cleanup: () => Promise<void>;
}): Promise<void> {
  let startupTask: Promise<void> | null = null;
  try {
    const runtimeLoopTask = params.runRuntimeLoop();
    startupTask = params.startDeferredStartup();
    void startupTask.catch(params.onDeferredStartupError);
    await runtimeLoopTask;
  } finally {
    if (startupTask) {
      await startupTask.catch(() => undefined);
    }
    await params.cleanup();
  }
}

export async function runConfiguredGatewayRuntime(params: {
  uiStartup: UiStartupHandle | null;
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
  const replyRouter = createChannelReplyRouterService();

  logStartupTrace("service.start_gateway.runtime_loop_begin");
  await runGatewayRuntimeLoop({
    runRuntimeLoop: () =>
      runGatewayInboundLoop({
        bus: params.gateway.bus,
        sessionManager: params.gateway.sessionManager,
        getConfig: params.getConfig,
        resolveNcpAgent: params.getLiveUiNcpAgent,
        getChannels: () => params.gateway.reloader.getChannels(),
        replyRouter,
        onSystemSessionUpdated: ({ sessionKey }) =>
          onSystemSessionUpdated({ sessionKey }),
      }),
    startDeferredStartup: () =>
      startDeferredGatewayStartup({
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

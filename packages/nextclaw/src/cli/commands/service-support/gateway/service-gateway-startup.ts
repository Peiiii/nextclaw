import type * as NextclawCore from "@nextclaw/core";
import type { PluginChannelBinding, PluginUiMetadata } from "@nextclaw/openclaw-compat";
import {
  startUiServer,
  type BootstrapStatusView,
  type MarketplaceApiConfig,
  type UiNcpSessionService,
  type UiServerEvent,
  type UiRemoteAccessHost
} from "@nextclaw/server";
import { openBrowser } from "../../../utils.js";
import type { GatewayControllerImpl } from "../../../gateway/controller.js";
import type { GatewayAgentRuntimePool } from "../../agent/agent-runtime-pool.js";
import { createUiNcpAgent, type UiNcpAgentHandle } from "../../ncp/create-ui-ncp-agent.js";
import type { NextclawExtensionRegistry } from "../../plugins.js";
import { createDeferredUiNcpAgent, type DeferredUiNcpAgentController } from "../session/service-deferred-ncp-agent.js";
import type { DeferredUiNcpSessionServiceController } from "../session/service-deferred-ncp-session-service.js";
import { logStartupTrace, measureStartupAsync } from "../../../startup-trace.js";

type Config = NextclawCore.Config;
type MessageBus = NextclawCore.MessageBus;
type SessionManager = NextclawCore.SessionManager;
type ProviderManager = NextclawCore.ProviderManager;
type CronService = NextclawCore.CronService;

export type UiStartupHandle = {
  deferredNcpAgent: DeferredUiNcpAgentController;
  publish: (event: UiServerEvent) => void;
};

export function wireSystemSessionUpdatedPublisher(params: {
  runtimePool: Pick<GatewayAgentRuntimePool, "setSystemSessionUpdatedHandler">;
  publishUiEvent?: (event: UiServerEvent) => void;
}): void {
  params.runtimePool.setSystemSessionUpdatedHandler(({ sessionKey }) => {
    params.publishUiEvent?.({
      type: "session.updated",
      payload: { sessionKey }
    });
  });
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
  runtimePool: GatewayAgentRuntimePool;
  startDeferredStartup: () => Promise<void>;
  onDeferredStartupError: (error: unknown) => void;
  cleanup: () => Promise<void>;
}): Promise<void> {
  let startupTask: Promise<void> | null = null;
  try {
    const runtimePoolTask = params.runtimePool.run();
    startupTask = params.startDeferredStartup();
    void startupTask.catch(params.onDeferredStartupError);
    await runtimePoolTask;
  } finally {
    if (startupTask) {
      await startupTask.catch(() => undefined);
    }
    await params.cleanup();
  }
}

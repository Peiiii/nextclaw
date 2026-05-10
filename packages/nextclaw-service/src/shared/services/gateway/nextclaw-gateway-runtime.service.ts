import * as NextclawCore from "@nextclaw/core";
import { nextclaw, type EventBus, type UpdateSnapshot } from "@nextclaw/kernel";
import {
  setPluginRuntimeBridge,
} from "@nextclaw/openclaw-compat";
import { installBuiltinProviderRegistry } from "@nextclaw/runtime";
import {
  startUiServer,
  type UiNcpAgent,
  type UiRouterOptions,
  type UiRuntimeControlHost,
  type UiRuntimeUpdateHost,
} from "@nextclaw/server";
import { join, resolve } from "node:path";
import { setImmediate as waitForNextTick } from "node:timers/promises";
import type { UiNcpAgentHandle } from "@nextclaw-service/commands/ncp/index.js";
import { runGatewayInboundLoop } from "@nextclaw-service/commands/ncp/features/runtime/nextclaw-ncp-dispatch.utils.js";
import { GatewayControllerImpl } from "@nextclaw-service/shared/controllers/gateway.controller.js";
import { ServiceExtensionRuntime } from "@nextclaw-service/shared/services/extensions/service-extension-runtime.service.js";
import { GatewayChannelManager } from "@nextclaw-service/shared/services/gateway/managers/gateway-channel.manager.js";
import { GatewayConfigManager } from "@nextclaw-service/shared/services/gateway/managers/gateway-config.manager.js";
import { GatewayMarketplaceManager } from "@nextclaw-service/shared/services/gateway/managers/gateway-marketplace.manager.js";
import { GatewayPluginManager } from "@nextclaw-service/shared/services/gateway/managers/gateway-plugin.manager.js";
import { GatewayRemoteManager } from "@nextclaw-service/shared/services/gateway/managers/gateway-remote.manager.js";
import { GatewayRestartWakeService } from "@nextclaw-service/shared/services/gateway/gateway-restart-wake.service.js";
import { GatewayWorkspaceManager } from "@nextclaw-service/shared/services/gateway/managers/gateway-workspace.manager.js";
import { createCronJobHandler } from "@nextclaw-service/shared/services/gateway/cron-job-handler.service.js";
import { companionRuntimeService } from "@nextclaw-service/shared/services/ui/companion-runtime.service.js";
import { handleGatewayDeferredStartupError } from "@nextclaw-service/shared/services/gateway/utils/gateway-runtime-lifecycle.utils.js";
import { NextclawApp, type UiStartupHandle } from "@nextclaw-service/shared/services/gateway/nextclaw-app.service.js";
import { ServiceBootstrapStatusStore } from "@nextclaw-service/shared/services/gateway/service-bootstrap-status.js";
import { WebhookService } from "@nextclaw-service/shared/services/webhook/webhook.service.js";
import { ServiceFileWatcherRegistry, markLocalUiRuntimeIfStarted, startGatewayRuntimeSupport, watchServiceConfigFile } from "@nextclaw-service/shared/services/gateway/service-startup-support.service.js";
import { ServiceNcpSessionRealtimeBridge } from "@nextclaw-service/shared/services/session/service-ncp-session-realtime-bridge.service.js";
import { createDeferredUiNcpAgent } from "@nextclaw-service/shared/services/session/service-deferred-ncp-agent.service.js";
import { installPluginRuntimeBridge } from "@nextclaw-service/shared/services/plugin/utils/plugin-runtime-bridge.utils.js";
import { createNpmRuntimeUpdateHost } from "@nextclaw-service/shared/services/ui/npm-runtime-update-host.service.js";
import { createRuntimeControlHost } from "@nextclaw-service/shared/services/ui/runtime-control-host.service.js";
import { localUiRuntimeStore } from "@nextclaw-service/shared/stores/local-ui-runtime.store.js";
import { managedServiceStateStore } from "@nextclaw-service/shared/stores/managed-service-state.store.js";
import type { RequestRestartParams } from "@nextclaw-service/shared/types/cli.types.js";
import { getPackageVersion, openBrowser, resolveUiConfig, resolveUiStaticDir } from "@nextclaw-service/shared/utils/cli.utils.js";
import { logStartupTrace, measureStartupAsync, measureStartupSync } from "@nextclaw-service/shared/utils/startup-trace.js";

const {
  CronService,
  getConfigPath,
  getDataDir,
  loadConfig,
  MessageBus,
  ProviderManager,
  resolveConfigSecrets,
  saveConfig,
  SessionManager,
} = NextclawCore;

function resolveApplyRestartMode(uiPort: number): "managed-service-restart" | "manual-process-restart" {
  const serviceState = managedServiceStateStore.read();
  if (serviceState?.pid === process.pid) {
    return "managed-service-restart";
  }
  if (
    process.env.NEXTCLAW_RUNTIME_BUNDLE_CHILD === "1" &&
    typeof serviceState?.uiPort === "number" &&
    serviceState.uiPort === uiPort
  ) {
    return "managed-service-restart";
  }
  return "manual-process-restart";
}

class DisabledRuntimeUpdateHost implements UiRuntimeUpdateHost {
  private readonly snapshot: UpdateSnapshot = {
    status: "blocked",
    installationKind: "unknown",
    channel: "stable",
    hostVersion: null,
    currentVersion: null,
    availableVersion: null,
    downloadedVersion: null,
    minimumHostVersion: null,
    releaseNotesUrl: null,
    lastCheckedAt: null,
    progress: null,
    canAutoDownload: false,
    canApplyInApp: false,
    requiresRestart: false,
    blockReason: "unsupported-installation",
    recoveryCommand: null,
    errorMessage: "Runtime update host is disabled.",
    preferences: {
      automaticChecks: false,
      autoDownload: false,
    },
  };

  getState = (): UpdateSnapshot => this.snapshot;

  checkForUpdates = (): UpdateSnapshot => this.snapshot;

  downloadUpdate = (): UpdateSnapshot => this.snapshot;

  applyDownloadedUpdate = (): UpdateSnapshot => this.snapshot;

  updatePreferences = (): UpdateSnapshot => this.snapshot;

  updateChannel = (): UpdateSnapshot => this.snapshot;
}

type Config = NextclawCore.Config;
type LLMProvider = NextclawCore.LLMProvider;
type LiteLLMProvider = NextclawCore.LiteLLMProvider;
type MessageBus = NextclawCore.MessageBus;
type SessionManager = NextclawCore.SessionManager;
type ProviderManager = NextclawCore.ProviderManager;
type CronService = NextclawCore.CronService;

type GatewayRuntimeOptions = {
  uiOverrides?: Partial<Config["ui"]>;
  allowMissingProvider?: boolean;
  uiStaticDir?: string | null;
};

export type GatewayRuntimeDeps = {
  requestRestart: (params: RequestRestartParams) => Promise<void>;
  initializeAgentHomeDirectory: (homeDirectory: string) => void;
  startService: (options: { uiOverrides: Record<string, unknown>; open: boolean }) => Promise<void>;
  stopService: () => Promise<void>;
  createProvider: (config: Config, options?: { allowMissing?: boolean }) => LiteLLMProvider | null;
  createMissingProvider: (config: Config) => LLMProvider;
  runCliSubcommand: (args: string[]) => Promise<string>;
  installBuiltinMarketplaceSkill: (slug: string, force: boolean | undefined) => { message: string; output?: string } | null;
};

export class NextclawGatewayRuntime {
  readonly appEventBus: EventBus;
  readonly messageBus: MessageBus;
  readonly sessionManager: SessionManager;
  readonly cron: CronService;
  readonly runtimeControl: UiRuntimeControlHost;
  readonly runtimeUpdate: UiRuntimeUpdateHost;
  readonly webhook: WebhookService;
  readonly productVersion: string;
  readonly providerManager: ProviderManager;
  readonly gatewayController: GatewayControllerImpl;

  readonly configManager: GatewayConfigManager;
  readonly workspaceManager: GatewayWorkspaceManager;
  readonly remoteManager: GatewayRemoteManager;
  readonly marketplaceManager: GatewayMarketplaceManager;
  readonly gatewayChannels: GatewayChannelManager;
  readonly plugins: GatewayPluginManager;
  readonly restartWake: GatewayRestartWakeService;
  bootstrapStatus: ServiceBootstrapStatusStore;
  readonly sessions: ServiceNcpSessionRealtimeBridge;
  uiStartup: UiStartupHandle;
  readonly extensions: ServiceExtensionRuntime;
  liveUiNcpAgent: UiNcpAgentHandle | null = null;
  readonly fileWatchers = new ServiceFileWatcherRegistry();

  constructor(
    private readonly deps: GatewayRuntimeDeps,
    private readonly options: GatewayRuntimeOptions = {},
  ) {
    const configPath = getConfigPath();
    const config = resolveConfigSecrets(loadConfig(), { configPath });
    const uiConfig = resolveUiConfig(config, options.uiOverrides);
    const uiStaticDir = options.uiStaticDir === undefined ? resolveUiStaticDir() : options.uiStaticDir;

    this.workspaceManager = new GatewayWorkspaceManager({
      config,
      initializeAgentHomeDirectory: this.deps.initializeAgentHomeDirectory,
    });
    this.appEventBus = nextclaw.eventBus;
    this.messageBus = new MessageBus();
    this.sessionManager = measureStartupSync(
      "service.gateway.session_manager",
      () => new SessionManager({ workspace: this.workspaceManager.workspace, homeDir: getDataDir() })
    );
    this.cron = new CronService(join(getDataDir(), "cron", "jobs.json"));
    this.webhook = new WebhookService();
    this.productVersion = getPackageVersion();
    this.plugins = new GatewayPluginManager(this);
    this.providerManager = this.createProviderManager(config);
    this.configManager = new GatewayConfigManager({
      configPath,
      config,
      uiConfig,
      uiStaticDir,
      deps: this.deps,
      gateway: this,
    });
    this.restartWake = new GatewayRestartWakeService(this);
    this.bootstrapStatus = this.createBootstrapStatus();
    this.sessions = new ServiceNcpSessionRealtimeBridge(this);
    this.uiStartup = this.createDisabledUiStartup();
    this.extensions = new ServiceExtensionRuntime(this);
    this.remoteManager = new GatewayRemoteManager({
      deps: this.deps,
      configManager: this.configManager,
    });
    this.marketplaceManager = new GatewayMarketplaceManager({
      deps: this.deps,
      configManager: this.configManager,
    });
    this.runtimeControl = createRuntimeControlHost({
      serviceCommands: this.deps,
      requestRestart: this.deps.requestRestart,
      uiConfig: this.configManager.uiConfig,
    });
    this.runtimeUpdate =
      process.env.NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST === "1"
        ? new DisabledRuntimeUpdateHost()
        : createNpmRuntimeUpdateHost({
            applyRestartMode: resolveApplyRestartMode(this.configManager.uiConfig.port),
            requestRestart: this.deps.requestRestart,
            uiConfig: this.configManager.uiConfig,
          });
    this.gatewayController = this.createGatewayController();
    this.gatewayChannels = new GatewayChannelManager(this);
    this.cron.onJob = createCronJobHandler({
      resolveNcpAgent: () => this.liveUiNcpAgent,
      bus: this.messageBus,
    });
  }

  start = async (): Promise<void> => {
    installBuiltinProviderRegistry();
    logStartupTrace("service.start_gateway.begin");
    await this.reset();
    this.configureWebhookHandlers();
    this.uiStartup = await this.startUiRuntime();
    await companionRuntimeService.applyConfig(this.configManager.config);
    await this.markUiRuntimeReady();
    this.configManager.reloader.setReloadCompanion(async ({ config: nextConfig }) => {
      await companionRuntimeService.applyConfig(nextConfig);
    });
    await this.startSupportServices();
    this.gatewayChannels.installDevHotReload();
    await this.runRuntimeLoop();
    await companionRuntimeService.ensureStopped();
    logStartupTrace("service.start_gateway.end");
  };

  private reset = async (): Promise<void> => {
    await this.fileWatchers.clear();
    this.bootstrapStatus = this.createBootstrapStatus();
    this.sessions.clear();
    this.uiStartup = this.createDisabledUiStartup();
    this.gatewayChannels.reset();
    this.liveUiNcpAgent = null;
  };

  get ncpAgent(): UiNcpAgent {
    return this.uiStartup.deferredNcpAgent.agent;
  }

  activateNcpAgent = (ncpAgent: UiNcpAgentHandle): void => {
    this.sessions.deferredSessionService.activate(ncpAgent.sessionApi);
    this.liveUiNcpAgent = ncpAgent;
    if (this.configManager.uiConfig.enabled) {
      this.uiStartup.deferredNcpAgent.activate(ncpAgent);
    }
    this.bootstrapStatus.markNcpAgentReady();
  };

  private createBootstrapStatus = (): ServiceBootstrapStatusStore => {
    const bootstrapStatus = new ServiceBootstrapStatusStore();
    bootstrapStatus.markNcpAgentPending();
    bootstrapStatus.markPluginHydrationPending();
    bootstrapStatus.markChannelsPending();
    bootstrapStatus.setRemoteState(this.configManager.config.remote.enabled ? "pending" : "disabled");
    return bootstrapStatus;
  };

  private createDisabledUiStartup = (): UiStartupHandle => ({
    deferredNcpAgent: createDeferredUiNcpAgent(),
    endpoint: "",
  });

  private startUiRuntime = async (): Promise<UiStartupHandle> => {
    const uiStartup = await measureStartupAsync("service.start_ui_runtime", async () => {
      logStartupTrace("service.start_ui_runtime.begin");
      if (!this.configManager.uiConfig.enabled) {
        return this.createDisabledUiStartup();
      }
      const deferredNcpAgent = this.uiStartup.deferredNcpAgent;
      const uiServer = await startUiServer(this.createUiRouterOptions());
      const uiUrl = NextclawCore.resolveLocalUiBaseUrl({
        host: uiServer.host,
        port: uiServer.port,
      });
      console.log(`✓ UI API: ${uiUrl}/api`);
      if (this.configManager.uiStaticDir) {
        console.log(`✓ UI frontend: ${uiUrl}`);
      }
      if (this.configManager.uiConfig.open) {
        openBrowser(uiUrl);
      }
      logStartupTrace("service.start_ui_runtime.ready", {
        host: uiServer.host,
        port: uiServer.port,
      });
      return {
        deferredNcpAgent,
        endpoint: uiUrl,
      };
    });
    markLocalUiRuntimeIfStarted({
      uiStartup: this.configManager.uiConfig.enabled ? uiStartup : null,
      uiConfig: this.configManager.uiConfig,
    });
    return uiStartup;
  };

  private createUiRouterOptions = (): UiRouterOptions => ({
    configPath: this.configManager.configPath,
    appEventBus: this.appEventBus,
    uiConfig: this.configManager.uiConfig,
    uiStaticDir: this.configManager.uiStaticDir,
    productVersion: this.productVersion,
    applyLiveConfigReload: this.configManager.applyLiveConfigReload,
    initializeAgentHomeDirectory: this.workspaceManager.initializeAgentHomeDirectory,
    marketplace: this.marketplaceManager.marketplace,
    cron: this.cron,
    ncpAgent: this.ncpAgent,
    sessions: this.sessions,
    remoteAccess: this.remoteManager.remoteAccess,
    runtimeControl: this.runtimeControl,
    runtimeUpdate: this.runtimeUpdate,
    webhook: this.webhook,
    bootstrapStatus: this.bootstrapStatus,
    plugins: this.plugins,
  });

  private runRuntimeLoop = async (): Promise<void> => {
    logStartupTrace("service.start_gateway.runtime_loop_begin");
    let startupTask: Promise<void> | null = null;
    try {
      const runtimeLoopTask = runGatewayInboundLoop(this);
      startupTask = this.startDeferredRuntime();
      void startupTask.catch((error) => handleGatewayDeferredStartupError({
        bootstrapStatus: this.bootstrapStatus,
        error,
      }));
      await runtimeLoopTask;
    } finally {
      if (startupTask) {
        await startupTask.catch(() => undefined);
      }
      await this.cleanup();
    }
  };

  private startDeferredRuntime = async (): Promise<void> => {
    const app = new NextclawApp(this);
    await app.start();
  };

  private cleanup = async (): Promise<void> => {
    localUiRuntimeStore.clearIfOwnedByProcess();
    await this.fileWatchers.clear();
    this.liveUiNcpAgent = null;
    this.sessions.clear();
    await this.uiStartup.deferredNcpAgent.close();
    await this.extensions.stop();
    await this.remoteManager.stop();
    await this.plugins.stopGateways();
    setPluginRuntimeBridge(null);
  };

  private markUiRuntimeReady = async (): Promise<void> => {
    this.bootstrapStatus.markShellReady();
    await waitForNextTick();
  };

  private createProviderManager = (config: Config): ProviderManager => {
    const provider =
      this.options.allowMissingProvider === true
        ? this.deps.createProvider(config, { allowMissing: true })
        : this.deps.createProvider(config);
    const manager = measureStartupSync(
      "service.gateway.provider_manager",
      () => new ProviderManager({
        defaultProvider: provider ?? this.deps.createMissingProvider(config),
        config,
      })
    );
    if (!provider) {
      console.warn(
        "Warning: No API key configured. The gateway is running, but agent replies are disabled until provider config is set.",
      );
    }
    return manager;
  };

  private createGatewayController = (): GatewayControllerImpl => {
    return measureStartupSync(
      "service.gateway.gateway_controller",
      () => new GatewayControllerImpl({
        reloader: this.configManager.reloader,
        cron: this.cron,
        sessionManager: this.sessionManager,
        getConfigPath,
        saveConfig,
        requestRestart: async (options) => {
          await this.deps.requestRestart({
            reason: options?.reason ?? "gateway tool restart",
            manualMessage: "Restart the gateway to apply changes.",
            strategy: "background-service-or-exit",
            delayMs: options?.delayMs,
            silentOnServiceRestart: true,
          });
        },
      })
    );
  };

  private startSupportServices = async (): Promise<void> => {
    this.plugins.publishConfigChanges();
    this.configurePluginRuntime();
    await measureStartupAsync("service.start_gateway_support_services", async () =>
      await startGatewayRuntimeSupport({
        cronJobs: this.cron.status().jobs,
        remoteModule: this.remoteManager.remoteModule,
        watchConfigFile: () => watchServiceConfigFile({
          configPath: resolve(getConfigPath()),
          watcherRegistry: this.fileWatchers,
          scheduleReload: (reason) => this.configManager.reloader.scheduleReload(reason)
        }),
        startCron: () => this.cron.start(),
        cronStorePath: resolve(join(getDataDir(), "cron", "jobs.json")),
        reloadCronStore: () => this.cron.reloadFromStore(),
        watcherRegistry: this.fileWatchers
      })
    );
  };

  private configurePluginRuntime = (): void => {
    this.configManager.reloader.setReloadPlugins(async ({ config: nextConfig, changedPaths }) => {
      const result = await this.plugins.reloadForConfigChange({
        config: nextConfig,
        changedPaths,
      });
      if (result.restartChannels) {
        console.log("Config reload: plugin channel gateways restarted.");
      }
      return { restartChannels: result.restartChannels };
    });
    this.configManager.reloader.setReloadMcp(async ({ config: nextConfig }) => {
      await this.liveUiNcpAgent?.applyMcpConfig?.(nextConfig);
    });
    installPluginRuntimeBridge(this);
  };

  private configureWebhookHandlers = (): void => {
    this.extensions.registerWebhookHandlers(this.webhook);
  };

}

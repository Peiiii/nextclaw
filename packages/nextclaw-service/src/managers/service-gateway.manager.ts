import * as NextclawCore from "@nextclaw/core";
import {
  AgentRunClient,
  NextclawKernel,
  resolveAutomaticUpdateCheckIntervalMs,
  runGatewayInboundLoop,
  type AutomationManager,
  type ConfigManager,
  type LlmProviderManager,
  type SessionManager,
} from "@nextclaw/kernel";
import type { EventBus, Ingress } from "@nextclaw/shared";
import {
  startUiServer,
  type MarketplaceApiConfig,
  type UiRouterOptions,
  type UiRuntimeControlHost,
} from "@nextclaw/server";
import { resolve } from "node:path";
import { setImmediate as waitForNextTick } from "node:timers/promises";
import { GatewayControllerImpl } from "@nextclaw-service/controllers/gateway.controller.js";
import { GatewayExtensionManager } from "@nextclaw-service/managers/gateway-extension.manager.js";
import { GatewayRemoteManager } from "@nextclaw-service/managers/gateway-remote.manager.js";
import { GatewayRestartWakeService } from "@nextclaw-service/services/gateway/gateway-restart-wake.service.js";
import { createCronJobHandler } from "@nextclaw-service/utils/gateway-cron-job-handler.utils.js";
import { companionRuntimeService } from "@nextclaw-service/services/ui/companion-runtime.service.js";
import { handleGatewayDeferredStartupError } from "@nextclaw-service/utils/gateway-runtime-lifecycle.utils.js";
import { NextclawApp, type UiStartupHandle } from "@nextclaw-service/services/gateway/nextclaw-app.service.js";
import { NextclawDistributionService } from "@nextclaw-service/services/runtime/nextclaw-distribution.service.js";
import { ServiceBootstrapStatusStore } from "@nextclaw-service/services/gateway/service-bootstrap-status.service.js";
import { GatewayRuntimeSupportService, ServiceFileWatcherRegistry, markLocalUiRuntimeIfStarted, watchServiceConfigFile } from "@nextclaw-service/services/gateway/service-startup-support.service.js";
import { ServiceMarketplaceInstaller } from "@nextclaw-service/services/marketplace/service-marketplace-installer.service.js";
import { NpmRuntimeUpdateHost } from "@nextclaw-service/services/runtime/npm-runtime-update-host.service.js";
import { createRuntimeControlHost } from "@nextclaw-service/services/ui/runtime-control-host.service.js";
import { localUiRuntimeStore } from "@nextclaw-service/stores/local-ui-runtime.store.js";
import { managedServiceStateStore } from "@nextclaw-service/stores/managed-service-state.store.js";
import type { RequestRestartParams } from "@nextclaw-service/types/cli.types.js";
import { openBrowser, resolveUiConfig, resolveUiStaticDir } from "@nextclaw-service/utils/cli.utils.js";
import { readPanelAppClientSdkScript } from "@nextclaw-service/utils/panel-app-client-sdk/panel-app-client-sdk-script.utils.js";
import { logStartupTrace, measureStartupAsync, measureStartupSync } from "@nextclaw-service/utils/startup-trace.utils.js";

const {
  getConfigPath,
  getDataDir,
  getWorkspacePath,
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

type Config = NextclawCore.Config;
type MessageBus = NextclawCore.MessageBus;

type GatewayRuntimeOptions = {
  uiOverrides?: Partial<Config["ui"]>;
  uiStaticDir?: string | null;
};

export type GatewayRuntimeDeps = {
  requestRestart: (params: RequestRestartParams) => Promise<void>;
  initializeAgentHomeDirectory: (homeDirectory: string) => void;
  startService: (options: { uiOverrides: Record<string, unknown>; open: boolean }) => Promise<void>;
  stopService: () => Promise<void>;
  runCliSubcommand: (args: string[]) => Promise<string>;
  installBuiltinMarketplaceSkill: (slug: string, force: boolean | undefined) => { message: string; output?: string } | null;
};

export class ServiceGatewayManager {
  readonly kernel: NextclawKernel;
  readonly appEventBus: EventBus;
  readonly messageBus: MessageBus;
  readonly sessionManager: SessionManager;
  readonly automation: AutomationManager;
  readonly agentRunClient: AgentRunClient;
  readonly runtimeControl: UiRuntimeControlHost;
  readonly runtimeUpdate: NpmRuntimeUpdateHost | null;
  readonly ingress: Ingress;
  readonly distribution = NextclawDistributionService.get();
  readonly productVersion: string;
  readonly providerManager: LlmProviderManager;
  readonly gatewayController: GatewayControllerImpl;

  readonly configManager: ConfigManager;
  readonly uiConfig: Config["ui"];
  readonly uiStaticDir: string | null;
  readonly workspace: string;
  readonly remoteManager: GatewayRemoteManager;
  readonly marketplace: MarketplaceApiConfig;
  readonly extensions: GatewayExtensionManager;
  readonly restartWake: GatewayRestartWakeService;
  bootstrapStatus: ServiceBootstrapStatusStore;
  uiStartup: UiStartupHandle;
  readonly fileWatchers = new ServiceFileWatcherRegistry();
  private deferredChannelStarter: () => Promise<void>;

  constructor(
    private readonly deps: GatewayRuntimeDeps,
    private readonly options: GatewayRuntimeOptions,
  ) {
    const configPath = getConfigPath();
    this.kernel = measureStartupSync(
      "service.gateway.kernel",
      () => new NextclawKernel({
        homeDir: getDataDir(),
        configPath,
      }),
    );
    this.configManager = this.kernel.configManager;
    const config = this.configManager.config;
    this.uiConfig = resolveUiConfig(config, options.uiOverrides);
    this.uiStaticDir = options.uiStaticDir === undefined ? resolveUiStaticDir(this.distribution.uiDistDir) : options.uiStaticDir;
    this.workspace = getWorkspacePath(config.agents.defaults.workspace);
    this.appEventBus = this.kernel.eventBus;
    this.ingress = this.kernel.ingress;
    this.agentRunClient = new AgentRunClient({
      eventBus: this.kernel.eventBus,
      ingress: this.kernel.ingress,
    });
    this.messageBus = this.kernel.messageBus;
    this.sessionManager = this.kernel.sessionManager;
    this.automation = this.kernel.automation;
    this.productVersion = this.distribution.version;
    this.extensions = new GatewayExtensionManager(this);
    this.providerManager = this.kernel.llmProviders;
    this.installConfigHostHooks();
    this.restartWake = new GatewayRestartWakeService(this);
    this.bootstrapStatus = this.createBootstrapStatus();
    this.uiStartup = this.createDisabledUiStartup();
    this.remoteManager = new GatewayRemoteManager({
      deps: this.deps,
      configManager: this.configManager,
      uiConfig: this.uiConfig,
      onRemoteStateChange: (state) => this.bootstrapStatus.syncRemoteRuntimeState(state),
    });
    this.marketplace = this.createMarketplace();
    this.runtimeControl = createRuntimeControlHost({
      serviceCommands: this.deps,
      requestRestart: this.deps.requestRestart,
      uiConfig: this.uiConfig,
    });
    this.runtimeUpdate =
      process.env.NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST === "1"
        ? null
        : new NpmRuntimeUpdateHost({
            eventBus: this.appEventBus,
            applyRestartMode: resolveApplyRestartMode(this.uiConfig.port),
            requestRestart: this.deps.requestRestart,
            uiConfig: this.uiConfig,
            automaticCheckIntervalMs: resolveAutomaticUpdateCheckIntervalMs({
              verificationMode: process.env.NEXTCLAW_UPDATE_VERIFICATION_MODE === "1",
              verificationIntervalMs: process.env.NEXTCLAW_UPDATE_VERIFICATION_INTERVAL_MS,
            }),
          });
    this.gatewayController = this.createGatewayController();
    this.kernel.provideGatewayController(this.gatewayController);
    this.deferredChannelStarter = this.startChannels;
    this.automation.onJob = createCronJobHandler({
      agentRunClient: this.agentRunClient,
    });
  }

  start = async (): Promise<void> => {
    logStartupTrace("service.start_gateway.begin");
    await this.reset();
    this.runtimeUpdate?.start();
    this.configureIngressHandlers();
    this.uiStartup = await this.startUiRuntime();
    await companionRuntimeService.applyConfig(this.configManager.config);
    await this.markUiRuntimeReady();
    await this.startSupportServices();
    await this.runRuntimeLoop();
    await companionRuntimeService.ensureStopped();
    logStartupTrace("service.start_gateway.end");
  };

  private reset = async (): Promise<void> => {
    await this.fileWatchers.clear();
    this.bootstrapStatus = this.createBootstrapStatus();
    this.uiStartup = this.createDisabledUiStartup();
    this.deferredChannelStarter = this.startChannels;
  };

  private createBootstrapStatus = (): ServiceBootstrapStatusStore => {
    const bootstrapStatus = new ServiceBootstrapStatusStore();
    bootstrapStatus.markChannelsPending();
    bootstrapStatus.setRemoteState(this.configManager.config.remote.enabled ? "pending" : "disabled");
    return bootstrapStatus;
  };

  private createDisabledUiStartup = (): UiStartupHandle => ({
    endpoint: "",
  });

  private startUiRuntime = async (): Promise<UiStartupHandle> => {
    const uiStartup = await measureStartupAsync("service.start_ui_runtime", async () => {
      logStartupTrace("service.start_ui_runtime.begin");
      if (!this.uiConfig.enabled) {
        return this.createDisabledUiStartup();
      }
      const uiServer = await startUiServer(this.createUiRouterOptions());
      const uiUrl = NextclawCore.resolveLocalUiBaseUrl({
        host: uiServer.host,
        port: uiServer.port,
      });
      console.log(`✓ UI API: ${uiUrl}/api`);
      if (this.uiStaticDir) {
        console.log(`✓ UI frontend: ${uiUrl}`);
      }
      if (this.uiConfig.open) {
        openBrowser(uiUrl);
      }
      logStartupTrace("service.start_ui_runtime.ready", {
        host: uiServer.host,
        port: uiServer.port,
      });
      return {
        endpoint: uiUrl,
      };
    });
    markLocalUiRuntimeIfStarted({
      uiStartup: this.uiConfig.enabled ? uiStartup : null,
      uiConfig: this.uiConfig,
    });
    return uiStartup;
  };

  private createUiRouterOptions = (): UiRouterOptions => ({
    kernel: this.kernel,
    configPath: this.configManager.configPath,
    appEventBus: this.appEventBus,
    uiConfig: this.uiConfig,
    uiStaticDir: this.uiStaticDir,
    panelAppClientSdkScript: readPanelAppClientSdkScript,
    productVersion: this.productVersion,
    applyLiveConfigReload: this.configManager.applyLiveConfigReload,
    initializeAgentHomeDirectory: this.deps.initializeAgentHomeDirectory,
    marketplace: this.marketplace,
    cron: this.automation,
    remoteAccess: this.remoteManager.remoteAccess,
    runtimeControl: this.runtimeControl,
    ...(this.runtimeUpdate ? { runtimeUpdate: this.runtimeUpdate } : {}),
    bootstrapStatus: this.bootstrapStatus,
    extensions: this.extensions,
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
      await this.stop();
    }
  };

  private startDeferredRuntime = async (): Promise<void> => {
    const app = new NextclawApp(this);
    await app.start();
  };

  readonly startDeferredChannels = async (): Promise<void> => {
    await this.deferredChannelStarter();
  };

  private readonly startChannels = async (): Promise<void> => {
    await this.kernel.channels.start();
    const enabledChannels = this.kernel.channels.enabledChannels;
    if (enabledChannels.length > 0) {
      console.log(`✓ Channels enabled: ${enabledChannels.join(", ")}`);
    } else {
      console.log("Warning: No channels enabled");
    }
    this.bootstrapStatus.markChannelsReady(enabledChannels);
  };

  private createMarketplace = (): MarketplaceApiConfig => ({
    apiBaseUrl: process.env.NEXTCLAW_MARKETPLACE_API_BASE,
    installer: new ServiceMarketplaceInstaller({
      applyLiveConfigReload: this.configManager.applyLiveConfigReload,
      runCliSubcommand: this.deps.runCliSubcommand,
      installBuiltinSkill: this.deps.installBuiltinMarketplaceSkill,
    }).createInstaller(),
  });

  readonly stop = async (): Promise<void> => {
    localUiRuntimeStore.clearIfOwnedByProcess();
    this.runtimeUpdate?.dispose();
    await this.fileWatchers.clear();
    await this.kernel.extensions.stop();
    await this.remoteManager.stop();
  };

  private markUiRuntimeReady = async (): Promise<void> => {
    this.bootstrapStatus.markShellReady();
    await waitForNextTick();
  };

  private createGatewayController = (): GatewayControllerImpl => {
    return measureStartupSync(
      "service.gateway.gateway_controller",
      () => new GatewayControllerImpl({
        configManager: this.configManager,
        channels: this.kernel.channels,
        cron: this.automation,
        sessionManager: this.sessionManager,
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
    this.extensions.publishConfigChanges();
    await measureStartupAsync("service.start_gateway_support_services", async () =>
      await new GatewayRuntimeSupportService({
        automation: this.automation,
        remoteModule: this.remoteManager.remoteModule,
        watchConfigFile: () => watchServiceConfigFile({
          configPath: resolve(getConfigPath()),
          watcherRegistry: this.fileWatchers,
          scheduleReload: (reason) => this.configManager.scheduleReload(reason)
        }),
        watcherRegistry: this.fileWatchers
      }).start()
    );
  };

  private installConfigHostHooks = (): void => {
    this.configManager.installRuntimeHooks({
      reloadCompanion: async ({ config: nextConfig }) => {
        await companionRuntimeService.applyConfig(nextConfig);
      },
      onRestartRequired: (paths) => {
        void this.deps.requestRestart({
          changedPaths: paths,
          manualMessage: `已保存以下改动，等待你手动重启后生效：${paths.join(", ")}`,
          mode: "notify",
          reason: `config reload requires restart: ${paths.join(", ")}`,
          strategy: "background-service-or-manual",
        });
      },
    });
  };

  private configureIngressHandlers = (): void => {
    this.kernel.extensions.registerIngressHandlers();
  };

}

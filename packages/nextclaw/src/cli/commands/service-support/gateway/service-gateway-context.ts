import * as NextclawCore from "@nextclaw/core";
import { getPluginChannelBindings, resolvePluginChannelMessageToolHints } from "@nextclaw/openclaw-compat";
import type { RemoteServiceModule } from "@nextclaw/remote";
import { join } from "node:path";
import { GatewayControllerImpl } from "../../../gateway/controller.js";
import { ConfigReloader } from "../../../config-reloader.js";
import type { RequestRestartParams } from "../../../types.js";
import { resolveUiConfig, resolveUiStaticDir } from "../../../utils.js";
import { GatewayAgentRuntimePool } from "../../agent/agent-runtime-pool.js";
import { resolveChannelConfigView } from "../../channel/channel-config-view.js";
import { loadPluginRegistry, logPluginDiagnostics, toExtensionRegistry, type NextclawExtensionRegistry } from "../../plugins.js";
import { createCronJobHandler } from "./service-cron-job-handler.js";
import { createManagedRemoteModuleForUi } from "../runtime/service-remote-runtime.js";
import { measureStartupSync } from "../../../startup-trace.js";

const {
  ChannelManager,
  CronService,
  getConfigPath,
  getDataDir,
  getWorkspacePath,
  HeartbeatService,
  loadConfig,
  MessageBus,
  ProviderManager,
  resolveConfigSecrets,
  saveConfig,
  SessionManager,
} = NextclawCore;

type Config = NextclawCore.Config;
type PluginRegistry = ReturnType<typeof loadPluginRegistry>;

export type GatewayStartupContext = {
  runtimeConfigPath: string;
  config: Config;
  workspace: string;
  pluginRegistry: PluginRegistry;
  pluginChannelBindings: ReturnType<typeof getPluginChannelBindings>;
  extensionRegistry: NextclawExtensionRegistry;
  bus: NextclawCore.MessageBus;
  providerManager: NextclawCore.ProviderManager;
  sessionManager: NextclawCore.SessionManager;
  cron: NextclawCore.CronService;
  uiConfig: Config["ui"];
  uiStaticDir: string | null;
  remoteModule: RemoteServiceModule | null;
  reloader: ConfigReloader;
  gatewayController: GatewayControllerImpl;
  runtimePool: GatewayAgentRuntimePool;
  heartbeat: InstanceType<typeof HeartbeatService>;
  applyLiveConfigReload: () => Promise<void>;
};

export type GatewayShellContext = Pick<
  GatewayStartupContext,
  "runtimeConfigPath" | "config" | "workspace" | "sessionManager" | "cron" | "uiConfig" | "uiStaticDir" | "remoteModule"
>;

export type GatewayCapabilityState = Pick<
  GatewayStartupContext,
  "pluginRegistry" | "pluginChannelBindings" | "extensionRegistry"
>;

export function applyGatewayCapabilityState(
  gateway: GatewayCapabilityState,
  next: GatewayCapabilityState
): void {
  gateway.pluginRegistry = next.pluginRegistry;
  gateway.pluginChannelBindings = next.pluginChannelBindings;
  gateway.extensionRegistry = next.extensionRegistry;
}

export function createGatewayShellContext(params: {
  uiOverrides?: Partial<Config["ui"]>;
  uiStaticDir?: string | null;
}): GatewayShellContext {
  const runtimeConfigPath = getConfigPath();
  const config = resolveConfigSecrets(loadConfig(), { configPath: runtimeConfigPath });
  const workspace = getWorkspacePath(config.agents.defaults.workspace);
  const cronStorePath = join(getDataDir(), "cron", "jobs.json");
  const sessionManager = measureStartupSync(
    "service.gateway_shell_context.session_manager",
    () => new SessionManager(workspace)
  );
  const cron = new CronService(cronStorePath);
  const uiConfig = resolveUiConfig(config, params.uiOverrides);
  const uiStaticDir = params.uiStaticDir === undefined ? resolveUiStaticDir() : params.uiStaticDir;
  const remoteModule = createManagedRemoteModuleForUi({
    loadConfig: () => resolveConfigSecrets(loadConfig(), { configPath: runtimeConfigPath }),
    uiConfig,
  });

  return {
    runtimeConfigPath,
    config,
    workspace,
    sessionManager,
    cron,
    uiConfig,
    uiStaticDir,
    remoteModule,
  };
}

export function createGatewayStartupContext(params: {
  shellContext?: GatewayShellContext;
  uiOverrides?: Partial<Config["ui"]>;
  allowMissingProvider?: boolean;
  uiStaticDir?: string | null;
  initialPluginRegistry?: PluginRegistry;
  makeProvider: (config: Config, options?: { allowMissing?: boolean }) => NextclawCore.LLMProvider | null;
  makeMissingProvider: (config: Config) => NextclawCore.LLMProvider;
  requestRestart: (params: RequestRestartParams) => Promise<void>;
}): GatewayStartupContext {
  const state = {} as GatewayStartupContext;
  const shellContext = params.shellContext ?? createGatewayShellContext({
    uiOverrides: params.uiOverrides,
    uiStaticDir: params.uiStaticDir,
  });
  state.runtimeConfigPath = shellContext.runtimeConfigPath;
  state.config = shellContext.config;
  state.workspace = shellContext.workspace;
  state.sessionManager = shellContext.sessionManager;
  state.cron = shellContext.cron;
  state.uiConfig = shellContext.uiConfig;
  state.uiStaticDir = shellContext.uiStaticDir;
  state.remoteModule = shellContext.remoteModule;
  state.pluginRegistry = params.initialPluginRegistry ?? measureStartupSync(
    "service.gateway_context.load_plugin_registry",
    () => loadPluginRegistry(state.config, state.workspace)
  );
  state.pluginChannelBindings = measureStartupSync(
    "service.gateway_context.get_plugin_channel_bindings",
    () => getPluginChannelBindings(state.pluginRegistry)
  );
  state.extensionRegistry = measureStartupSync(
    "service.gateway_context.to_extension_registry",
    () => toExtensionRegistry(state.pluginRegistry)
  );
  logPluginDiagnostics(state.pluginRegistry);

  state.bus = new MessageBus();
  const provider =
    params.allowMissingProvider === true
      ? params.makeProvider(state.config, { allowMissing: true })
      : params.makeProvider(state.config);
  state.providerManager = measureStartupSync(
    "service.gateway_context.provider_manager",
    () => new ProviderManager({
      defaultProvider: provider ?? params.makeMissingProvider(state.config),
      config: state.config,
    })
  );
  if (!provider) {
    console.warn(
      "Warning: No API key configured. The gateway is running, but agent replies are disabled until provider config is set.",
    );
  }

  const channels = new ChannelManager(
    resolveChannelConfigView(state.config, state.pluginChannelBindings),
    state.bus,
    state.sessionManager,
    state.extensionRegistry.channels,
  );
  state.reloader = measureStartupSync(
    "service.gateway_context.config_reloader",
    () => new ConfigReloader({
      initialConfig: state.config,
      channels,
      bus: state.bus,
      sessionManager: state.sessionManager,
      providerManager: state.providerManager,
      makeProvider: (nextConfig) =>
        params.makeProvider(nextConfig, { allowMissing: true }) ?? params.makeMissingProvider(nextConfig),
      loadConfig: () => resolveConfigSecrets(loadConfig(), { configPath: state.runtimeConfigPath }),
      resolveChannelConfig: (nextConfig) => resolveChannelConfigView(nextConfig, state.pluginChannelBindings),
      getExtensionChannels: () => state.extensionRegistry.channels,
      onRestartRequired: (paths) => {
        void params.requestRestart({
          reason: `config reload requires restart: ${paths.join(", ")}`,
          manualMessage: `Config changes require restart: ${paths.join(", ")}`,
          strategy: "background-service-or-manual",
        });
      },
    })
  );
  state.applyLiveConfigReload = async () => {
    await state.reloader.applyReloadPlan(resolveConfigSecrets(loadConfig(), { configPath: state.runtimeConfigPath }));
  };

  state.gatewayController = measureStartupSync(
    "service.gateway_context.gateway_controller",
    () => new GatewayControllerImpl({
      reloader: state.reloader,
      cron: state.cron,
      sessionManager: state.sessionManager,
      getConfigPath,
      saveConfig,
      requestRestart: async (options) => {
        await params.requestRestart({
          reason: options?.reason ?? "gateway tool restart",
          manualMessage: "Restart the gateway to apply changes.",
          strategy: "background-service-or-exit",
          delayMs: options?.delayMs,
          silentOnServiceRestart: true,
        });
      },
    })
  );

  state.runtimePool = measureStartupSync(
    "service.gateway_context.runtime_pool",
    () => new GatewayAgentRuntimePool({
      bus: state.bus,
      providerManager: state.providerManager,
      sessionManager: state.sessionManager,
      config: state.config,
      cronService: state.cron,
      restrictToWorkspace: state.config.tools.restrictToWorkspace,
      searchConfig: state.config.search,
      execConfig: state.config.tools.exec,
      contextConfig: state.config.agents.context,
      gatewayController: state.gatewayController,
      extensionRegistry: state.extensionRegistry,
      resolveMessageToolHints: ({ channel, accountId }) =>
        resolvePluginChannelMessageToolHints({
          registry: state.pluginRegistry,
          channel,
          cfg: resolveConfigSecrets(loadConfig(), { configPath: state.runtimeConfigPath }),
          accountId,
        }),
    })
  );

  state.cron.onJob = createCronJobHandler({ runtimePool: state.runtimePool, bus: state.bus });

  state.heartbeat = new HeartbeatService(
    state.workspace,
    async (promptText) =>
      state.runtimePool.processDirect({
        content: promptText,
        sessionKey: "heartbeat",
        agentId: state.runtimePool.primaryAgentId,
      }),
    30 * 60,
    true,
  );

  return state;
}

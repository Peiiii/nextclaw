import * as NextclawCore from "@nextclaw/core";
import { getPluginChannelBindings } from "@nextclaw/openclaw-compat";
import type { RemoteServiceModule } from "@nextclaw/remote";
import { join } from "node:path";
import { GatewayControllerImpl } from "../../../gateway/controller.js";
import { ConfigReloader } from "../../../config-reloader.js";
import type { RequestRestartParams } from "../../../types.js";
import { resolveUiConfig, resolveUiStaticDir } from "../../../utils.js";
import type { UiNcpAgentHandle } from "../../ncp/create-ui-ncp-agent.service.js";
import { resolveChannelConfigView } from "../../channel/channel-config-view.js";
import { loadPluginRegistry, logPluginDiagnostics, toExtensionRegistry, type NextclawExtensionRegistry } from "../../plugins.js";
import { createCronJobHandler, createHeartbeatJobHandler } from "./service-cron-job-handler.js";
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
  resolveDefaultAgentProfileId,
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

function normalizeAgentId(value: string | undefined): string {
  const text = (value ?? "").trim().toLowerCase();
  return text || "main";
}

function createGatewayHeartbeat(state: Pick<
  GatewayStartupContext,
  "workspace" | "runtimeConfigPath"
>, params: {
  getLiveUiNcpAgent?: () => UiNcpAgentHandle | null;
}): InstanceType<typeof HeartbeatService> {
  const handleHeartbeat = createHeartbeatJobHandler({
    resolveNcpAgent: () => params.getLiveUiNcpAgent?.() ?? null,
    resolveAgentId: () =>
      normalizeAgentId(
        resolveDefaultAgentProfileId(
          resolveConfigSecrets(loadConfig(), { configPath: state.runtimeConfigPath }),
        ),
      ),
  });
  return new HeartbeatService(
    state.workspace,
    async (promptText) => await handleHeartbeat(promptText),
    30 * 60,
    true,
  );
}

function createGatewayCronJobHandler(params: {
  bus: NextclawCore.MessageBus;
  getLiveUiNcpAgent?: () => UiNcpAgentHandle | null;
}): ReturnType<typeof createCronJobHandler> {
  return createCronJobHandler({
    resolveNcpAgent: () => params.getLiveUiNcpAgent?.() ?? null,
    bus: params.bus,
  });
}

export function createGatewayShellContext(params: {
  uiOverrides?: Partial<Config["ui"]>;
  uiStaticDir?: string | null;
}): GatewayShellContext {
  const runtimeConfigPath = getConfigPath();
  const config = resolveConfigSecrets(loadConfig(), { configPath: runtimeConfigPath });
  const workspace = getWorkspacePath(config.agents.defaults.workspace);
  const homeDir = getDataDir();
  const cronStorePath = join(getDataDir(), "cron", "jobs.json");
  const sessionManager = measureStartupSync(
    "service.gateway_shell_context.session_manager",
    () => new SessionManager({ workspace, homeDir })
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
  getLiveUiNcpAgent?: () => UiNcpAgentHandle | null;
}): GatewayStartupContext {
  const {
    shellContext: providedShellContext,
    uiOverrides,
    allowMissingProvider,
    uiStaticDir,
    initialPluginRegistry,
    makeProvider,
    makeMissingProvider,
    requestRestart,
    getLiveUiNcpAgent,
  } = params;
  const state = {} as GatewayStartupContext;
  const shellContext = providedShellContext ?? createGatewayShellContext({
    uiOverrides,
    uiStaticDir,
  });
  state.runtimeConfigPath = shellContext.runtimeConfigPath;
  state.config = shellContext.config;
  state.workspace = shellContext.workspace;
  state.sessionManager = shellContext.sessionManager;
  state.cron = shellContext.cron;
  state.uiConfig = shellContext.uiConfig;
  state.uiStaticDir = shellContext.uiStaticDir;
  state.remoteModule = shellContext.remoteModule;
  state.pluginRegistry = initialPluginRegistry ?? measureStartupSync(
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
    allowMissingProvider === true
      ? makeProvider(state.config, { allowMissing: true })
      : makeProvider(state.config);
  state.providerManager = measureStartupSync(
    "service.gateway_context.provider_manager",
    () => new ProviderManager({
      defaultProvider: provider ?? makeMissingProvider(state.config),
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
        makeProvider(nextConfig, { allowMissing: true }) ?? makeMissingProvider(nextConfig),
      loadConfig: () => resolveConfigSecrets(loadConfig(), { configPath: state.runtimeConfigPath }),
      resolveChannelConfig: (nextConfig) => resolveChannelConfigView(nextConfig, state.pluginChannelBindings),
      getExtensionChannels: () => state.extensionRegistry.channels,
      onRestartRequired: (paths) => {
        void requestRestart({
          changedPaths: paths,
          manualMessage: `已保存以下改动，等待你手动重启后生效：${paths.join(", ")}`,
          mode: "notify",
          reason: `config reload requires restart: ${paths.join(", ")}`,
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
        await requestRestart({
          reason: options?.reason ?? "gateway tool restart",
          manualMessage: "Restart the gateway to apply changes.",
          strategy: "background-service-or-exit",
          delayMs: options?.delayMs,
          silentOnServiceRestart: true,
        });
      },
    })
  );

  state.cron.onJob = createGatewayCronJobHandler({ bus: state.bus, getLiveUiNcpAgent });
  state.heartbeat = createGatewayHeartbeat(state, { getLiveUiNcpAgent });

  return state;
}

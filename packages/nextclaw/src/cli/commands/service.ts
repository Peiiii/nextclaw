import * as NextclawCore from "@nextclaw/core";
import { resolvePluginChannelMessageToolHints } from "@nextclaw/openclaw-compat";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { setImmediate as waitForNextTick } from "node:timers/promises";
import { MissingProvider } from "../missing-provider.js";
import {
  getPackageVersion,
  isLoopbackHost,
  isProcessRunning,
  openBrowser,
  resolveServiceLogPath,
  resolveUiApiBase,
  resolveUiConfig,
  resolveUiStaticDir,
  resolvePublicIp,
  waitForExit
} from "../utils.js";
import type { RequestRestartParams } from "../types.js";
import { ServiceMarketplaceInstaller } from "./service-support/marketplace/service-marketplace-installer.js";
import { reportManagedServiceStart, resolveManagedServiceUiBinding, resolveSessionRouteCandidate, spawnManagedService, waitForManagedServiceReadiness } from "./service-support/runtime/service-managed-startup.js";
import { finalizeLocalUiStartup, ServiceFileWatcherRegistry, startGatewayRuntimeSupport, watchServiceConfigFile } from "./service-support/gateway/service-startup-support.js";
import { localUiRuntimeStore } from "../runtime-state/local-ui-runtime.store.js";
import { managedServiceStateStore, type ManagedServiceState } from "../runtime-state/managed-service-state.store.js";
import { consumeRestartSentinel, formatRestartSentinelMessage, parseSessionKey } from "../restart-sentinel.js";
import { resolveCliSubcommandEntry } from "./service-support/marketplace/cli-subcommand-launch.js";
import { writeReadyManagedServiceState } from "./service-support/runtime/service-remote-runtime.js";
import { createServiceUiHosts } from "./service-support/ui/service-ui-hosts.service.js";
import { type UiNcpAgentHandle } from "./ncp/create-ui-ncp-agent.service.js";
import { createGatewayShellContext, createGatewayStartupContext } from "./service-support/gateway/service-gateway-context.js";
import { runConfiguredGatewayRuntime, startUiShell } from "./service-support/gateway/service-gateway-startup.js";
import { createServiceNcpSessionRealtimeBridge } from "./service-support/session/service-ncp-session-realtime-bridge.js";
import { createEmptyPluginRegistry } from "./plugin/plugin-registry-loader.js";
import { configureGatewayPluginRuntime, createBootstrapStatus, createDeferredGatewayStartupHooks, createGatewayRuntimeState, type GatewayRuntimeState } from "./service-support/gateway/service-gateway-bootstrap.js";
import { cleanupGatewayRuntime, handleGatewayDeferredStartupError } from "./service-support/gateway/service-gateway-runtime-lifecycle.js";
import { inspectUiTarget, probeHealthEndpoint } from "./service-support/runtime/service-port-probe.js";
import { logStartupTrace, measureStartupAsync, measureStartupSync } from "../startup-trace.js";

export { buildMarketplaceSkillInstallArgs, pickUserFacingCommandSummary } from "./service-support/marketplace/service-marketplace-helpers.js";
export { resolveCliSubcommandEntry };
const {
  APP_NAME,
  getApiBase,
  getConfigPath,
  getProvider,
  getProviderName,
  getWorkspacePath,
  LiteLLMProvider,
  loadConfig,
  MessageBus,
  resolveConfigSecrets,
  SessionManager,
  parseAgentScopedSessionKey
} = NextclawCore;

type Config = NextclawCore.Config;
type LLMProvider = NextclawCore.LLMProvider;
type MessageBus = NextclawCore.MessageBus;
type SessionManager = NextclawCore.SessionManager;
type LiteLLMProvider = NextclawCore.LiteLLMProvider;
type SkillInfo = {
  name: string;
  path: string;
  source: "workspace" | "builtin";
};
type SkillsLoaderInstance = {
  listSkills: (filterUnavailable?: boolean) => SkillInfo[];
};
type SkillsLoaderConstructor = new (workspace: string, builtinSkillsDir?: string) => SkillsLoaderInstance;
type StartServiceOptions = {
  uiOverrides: Partial<Config["ui"]>;
  open: boolean;
  startupTimeoutMs?: number;
};

function createSkillsLoader(workspace: string): SkillsLoaderInstance | null {
  const ctor = (NextclawCore as { SkillsLoader?: SkillsLoaderConstructor }).SkillsLoader;
  if (!ctor) {
    return null;
  }
  return new ctor(workspace);
}

export class ServiceCommands {
  private applyLiveConfigReload: (() => Promise<void>) | null = null;
  private liveUiNcpAgent: UiNcpAgentHandle | null = null;
  private readonly fileWatchers = new ServiceFileWatcherRegistry();
  private readonly loggingRuntime = NextclawCore.getLoggingRuntime();
  private readonly serviceLogger = this.loggingRuntime.getLogger("service");
  private loggingInstalled = false;
  constructor(private deps: { requestRestart: (params: RequestRestartParams) => Promise<void>; initializeAgentHomeDirectory?: (homeDirectory: string) => void }) {}

  startGateway = async (options: { uiOverrides?: Partial<Config["ui"]>; allowMissingProvider?: boolean; uiStaticDir?: string | null } = {}): Promise<void> => {
    this.ensureRuntimeLoggingInstalled();
    logStartupTrace("service.start_gateway.begin");
    await this.fileWatchers.clear();
    this.applyLiveConfigReload = null;
    this.liveUiNcpAgent = null;
    const shellContext = measureStartupSync(
      "service.create_gateway_shell_context",
      () => createGatewayShellContext({ uiOverrides: options.uiOverrides, uiStaticDir: options.uiStaticDir })
    );
    const applyLiveConfigReload = async () => { await this.applyLiveConfigReload?.(); };
    let runtimeState: GatewayRuntimeState | null = null;
    const bootstrapStatus = createBootstrapStatus(shellContext.config.remote.enabled);
    const ncpSessionRealtimeBridge = createServiceNcpSessionRealtimeBridge({ sessionManager: shellContext.sessionManager });
    const marketplaceInstaller = new ServiceMarketplaceInstaller({ applyLiveConfigReload, runCliSubcommand: (args) => this.runCliSubcommand(args), installBuiltinSkill: (slug, force) => this.installBuiltinMarketplaceSkill(slug, force) }).createInstaller();
    const { remoteAccess, runtimeControl } = createServiceUiHosts({ serviceCommands: this, requestRestart: this.deps.requestRestart, uiConfig: shellContext.uiConfig, remoteModule: shellContext.remoteModule });
    const uiStartup = await measureStartupAsync("service.start_ui_shell", async () =>
      await startUiShell({
        uiConfig: shellContext.uiConfig,
        uiStaticDir: shellContext.uiStaticDir,
        cronService: shellContext.cron,
        getConfig: () => resolveConfigSecrets(loadConfig(), { configPath: shellContext.runtimeConfigPath }),
        configPath: getConfigPath(),
        productVersion: getPackageVersion(),
        getPluginChannelBindings: () => runtimeState?.pluginChannelBindings ?? [],
        getPluginUiMetadata: () => runtimeState?.pluginUiMetadata ?? [],
        marketplace: { apiBaseUrl: process.env.NEXTCLAW_MARKETPLACE_API_BASE, installer: marketplaceInstaller },
        remoteAccess,
        runtimeControl,
        getBootstrapStatus: () => bootstrapStatus.getStatus(),
        openBrowserWindow: shellContext.uiConfig.open,
        applyLiveConfigReload,
        ncpSessionService: ncpSessionRealtimeBridge.sessionService, initializeAgentHomeDirectory: this.deps.initializeAgentHomeDirectory
      })
    );
    finalizeLocalUiStartup({
      uiStartup,
      setUiEventPublisher: (publish) => ncpSessionRealtimeBridge.setUiEventPublisher(publish),
      uiConfig: shellContext.uiConfig
    });
    bootstrapStatus.markShellReady();
    await waitForNextTick();
    const gateway = measureStartupSync("service.create_gateway_startup_context", () =>
      createGatewayStartupContext({
        shellContext,
        uiOverrides: options.uiOverrides,
        allowMissingProvider: options.allowMissingProvider,
        uiStaticDir: options.uiStaticDir,
        initialPluginRegistry: createEmptyPluginRegistry(),
        makeProvider: (config, providerOptions) => providerOptions?.allowMissing === true
          ? this.makeProvider(config, { allowMissing: true })
          : this.makeProvider(config),
        makeMissingProvider: (config) => this.makeMissingProvider(config),
        requestRestart: (params) => this.deps.requestRestart(params),
        getLiveUiNcpAgent: () => this.liveUiNcpAgent
      })
    );
    this.applyLiveConfigReload = gateway.applyLiveConfigReload;
    const loadGatewayConfig = () => resolveConfigSecrets(loadConfig(), { configPath: gateway.runtimeConfigPath });
    const gatewayRuntimeState = createGatewayRuntimeState(gateway);
    runtimeState = gatewayRuntimeState;
    uiStartup?.publish({ type: "config.updated", payload: { path: "channels" } });
    uiStartup?.publish({ type: "config.updated", payload: { path: "plugins" } });
    configureGatewayPluginRuntime({ gateway, state: gatewayRuntimeState, getLiveUiNcpAgent: () => this.liveUiNcpAgent });
    console.log("✓ Capability hydration: scheduled in background");
    await measureStartupAsync("service.start_gateway_support_services", async () =>
      await startGatewayRuntimeSupport({
        cronJobs: gateway.cron.status().jobs,
        remoteModule: gateway.remoteModule,
        watchConfigFile: () => watchServiceConfigFile({
          configPath: resolve(getConfigPath()),
          watcherRegistry: this.fileWatchers,
          scheduleReload: (reason) => gateway.reloader.scheduleReload(reason)
        }),
        startCron: () => gateway.cron.start(),
        startHeartbeat: () => gateway.heartbeat.start(),
        cronStorePath: resolve(join(NextclawCore.getDataDir(), "cron", "jobs.json")),
        reloadCronStore: () => gateway.cron.reloadFromStore(),
        watcherRegistry: this.fileWatchers
      })
    );
    const deferredGatewayStartupHooks = createDeferredGatewayStartupHooks({
      uiStartup,
      gateway,
      state: gatewayRuntimeState,
      bootstrapStatus,
      getLiveUiNcpAgent: () => this.liveUiNcpAgent,
      setLiveUiNcpAgent: (ncpAgent) => { this.liveUiNcpAgent = ncpAgent; },
      wakeFromRestartSentinel: async () =>
        await this.wakeFromRestartSentinel({ bus: gateway.bus, sessionManager: gateway.sessionManager })
    });
    await runConfiguredGatewayRuntime({
      uiStartup,
      gateway,
      deferredNcpSessionService: ncpSessionRealtimeBridge.deferredSessionService,
      getConfig: loadGatewayConfig,
      getExtensionRegistry: () => gatewayRuntimeState.extensionRegistry,
      resolveMessageToolHints: ({ channel, accountId }) =>
        resolvePluginChannelMessageToolHints({
          registry: gatewayRuntimeState.pluginRegistry,
          channel,
          cfg: loadGatewayConfig(),
          accountId,
        }),
      deferredStartupHooks: deferredGatewayStartupHooks,
      getLiveUiNcpAgent: () => this.liveUiNcpAgent,
      publishSessionChange: ncpSessionRealtimeBridge.publishSessionChange,
      publishUiEvent: uiStartup?.publish,
      onDeferredStartupError: (error) =>
        handleGatewayDeferredStartupError({ bootstrapStatus, error }),
      cleanup: async () =>
        await cleanupGatewayRuntime({
          fileWatchers: this.fileWatchers,
          resetRuntimeState: () => {
            this.applyLiveConfigReload = null;
            this.liveUiNcpAgent = null;
          },
          clearRealtimeBridge: () => ncpSessionRealtimeBridge.clear(),
          uiStartup,
          remoteModule: gateway.remoteModule,
          runtimeState,
        }),
    });
    logStartupTrace("service.start_gateway.end");
  };

  private normalizeOptionalString = (value: unknown): string | undefined => {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  };

  private resolveMostRecentRoutableSessionKey = (sessionManager: SessionManager): string | undefined => {
    let best: { key: string; updatedAt: number } | null = null;
    for (const session of sessionManager.listSessions()) {
      const candidate = resolveSessionRouteCandidate({
        session,
        normalizeOptionalString: (value) => this.normalizeOptionalString(value)
      });
      if (!candidate) {
        continue;
      }
      if (!best || candidate.updatedAt >= best.updatedAt) {
        best = candidate;
      }
    }
    return best?.key;
  };

  private buildRestartWakePrompt = (params: {
    summary: string;
    reason?: string;
    note?: string;
    replyTo?: string;
  }): string => {
    const lines = [
      "System event: the gateway has restarted successfully.",
      "Please send one short confirmation to the user that you are back online.",
      "Do not call any tools.",
      "Use the same language as the user's recent conversation.",
      `Reference summary: ${params.summary}`
    ];

    const reason = this.normalizeOptionalString(params.reason);
    if (reason) {
      lines.push(`Restart reason: ${reason}`);
    }

    const note = this.normalizeOptionalString(params.note);
    if (note) {
      lines.push(`Extra note: ${note}`);
    }

    const replyTo = this.normalizeOptionalString(params.replyTo);
    if (replyTo) {
      lines.push(`Reply target message id: ${replyTo}. If suitable, include [[reply_to:${replyTo}]].`);
    }

    return lines.join("\n");
  };

  private wakeFromRestartSentinel = async (params: {
    bus: MessageBus;
    sessionManager: SessionManager;
  }): Promise<void> => {
    const sentinel = await consumeRestartSentinel();
    if (!sentinel) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));

    const payload = sentinel.payload;
    const summary = formatRestartSentinelMessage(payload);
    const sentinelSessionKey = this.normalizeOptionalString(payload.sessionKey);
    const fallbackSessionKey = sentinelSessionKey ? undefined : this.resolveMostRecentRoutableSessionKey(params.sessionManager);
    if (!sentinelSessionKey && fallbackSessionKey) {
      console.warn(`Warning: restart sentinel missing sessionKey; fallback to ${fallbackSessionKey}.`);
    }
    const sessionKey = sentinelSessionKey ?? fallbackSessionKey ?? "cli:default";
    const parsedSession = parseSessionKey(sessionKey);
    const parsedAgentSession = parseAgentScopedSessionKey(sessionKey);
    const parsedSessionRoute = parsedSession && parsedSession.channel !== "agent" ? parsedSession : null;

    const context = payload.deliveryContext;
    const channel =
      this.normalizeOptionalString(context?.channel) ??
      parsedSessionRoute?.channel ??
      this.normalizeOptionalString((params.sessionManager.getIfExists(sessionKey)?.metadata ?? {}).last_channel);
    const chatId =
      this.normalizeOptionalString(context?.chatId) ??
      parsedSessionRoute?.chatId ??
      this.normalizeOptionalString((params.sessionManager.getIfExists(sessionKey)?.metadata ?? {}).last_to);
    const replyTo = this.normalizeOptionalString(context?.replyTo);
    const accountId = this.normalizeOptionalString(context?.accountId);

    if (!channel || !chatId) {
      console.warn(`Warning: restart sentinel cannot resolve route for session ${sessionKey}.`);
      return;
    }

    const prompt = this.buildRestartWakePrompt({
      summary,
      reason: this.normalizeOptionalString(payload.stats?.reason),
      note: this.normalizeOptionalString(payload.message),
      ...(replyTo ? { replyTo } : {})
    });

    const metadata: Record<string, unknown> = {
      source: "restart-sentinel",
      restart_summary: summary,
      session_key_override: sessionKey,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(parsedAgentSession ? { target_agent_id: parsedAgentSession.agentId } : {}),
      ...(accountId ? { account_id: accountId, accountId } : {})
    };

    await params.bus.publishInbound({
      channel: "system",
      senderId: "restart-sentinel",
      chatId: `${channel}:${chatId}`,
      content: prompt,
      timestamp: new Date(),
      attachments: [],
      metadata
    });
  };

  runForeground = async (options: {
    uiOverrides: Partial<Config["ui"]>;
    open: boolean;
  }): Promise<void> => {
    const config = loadConfig();
    const uiConfig = resolveUiConfig(config, options.uiOverrides);
    const uiUrl = resolveUiApiBase(uiConfig.host, uiConfig.port);

    if (options.open) {
      openBrowser(uiUrl);
    }

    await this.startGateway({
      uiOverrides: options.uiOverrides,
      allowMissingProvider: true,
      uiStaticDir: resolveUiStaticDir()
    });
  };

  private handleExistingManagedService = async (params: {
    existing: ManagedServiceState;
    uiConfig: Config["ui"];
    options: StartServiceOptions;
  }): Promise<boolean> => {
    const { existing, options, uiConfig } = params;
    console.log(`✓ ${APP_NAME} is already running (PID ${existing.pid})`);
    console.log(`UI: ${existing.uiUrl}`);
    console.log(`API: ${existing.apiUrl}`);

    const binding = resolveManagedServiceUiBinding(existing);
    if (binding.host !== uiConfig.host || binding.port !== uiConfig.port) {
      console.log(
        `Detected running service UI bind (${binding.host}:${binding.port}); enforcing (${uiConfig.host}:${uiConfig.port})...`
      );
      await this.stopService();
      const stateAfterStop = managedServiceStateStore.read();
      if (stateAfterStop && isProcessRunning(stateAfterStop.pid)) {
        process.exitCode = 1;
        console.error("Error: Failed to stop running service while enforcing public UI exposure.");
        return true;
      }
      await this.startService(options);
      return true;
    }

    await this.printPublicUiUrls(binding.host, binding.port);
    console.log(`Logs: ${existing.logPath}`);
    this.printServiceControlHints();
    return true;
  };

  startService = async (options: StartServiceOptions): Promise<void> => {
    this.loggingRuntime.ensureReady();
    const { open, startupTimeoutMs, uiOverrides } = options;
    const config = loadConfig();
    const uiConfig = resolveUiConfig(config, uiOverrides);
    const uiUrl = resolveUiApiBase(uiConfig.host, uiConfig.port);
    const apiUrl = `${uiUrl}/api`;
    const staticDir = resolveUiStaticDir();

    const existing = managedServiceStateStore.read();
    if (existing && isProcessRunning(existing.pid)) {
      await this.handleExistingManagedService({ existing, uiConfig, options });
      return;
    }
    if (existing) managedServiceStateStore.clear();

    if (!staticDir) {
      return void (process.exitCode = 1, console.error(`Error: ${APP_NAME} UI frontend bundle not found. Reinstall or rebuild ${APP_NAME}. For dev-only overrides, set NEXTCLAW_UI_STATIC_DIR to a built frontend directory.`));
    }

    const healthUrl = `${apiUrl}/health`;
    const portPreflight = await this.checkUiPortPreflight({ host: uiConfig.host, port: uiConfig.port, healthUrl });
    if (!portPreflight.ok) {
      return void (
        process.exitCode = 1,
        console.error(`Error: Cannot start ${APP_NAME} because UI port ${uiConfig.port} is already occupied.`),
        console.error(portPreflight.message)
      );
    }
    if (portPreflight.reusedExistingHealthyTarget) {
      await this.reuseExistingHealthyStartTarget({ uiConfig, uiUrl, apiUrl, open });
      return;
    }

    await this.startNewManagedServiceTarget({
      config,
      uiConfig,
      uiUrl,
      apiUrl,
      healthUrl,
      startupTimeoutMs,
    });

    if (open) {
      openBrowser(uiUrl);
    }
  };

  private reuseExistingHealthyStartTarget = async (params: {
    uiConfig: Config["ui"];
    uiUrl: string;
    apiUrl: string;
    open: boolean;
  }): Promise<void> => {
    const { apiUrl, open, uiConfig, uiUrl } = params;
    console.log(`✓ ${APP_NAME} is already serving the target UI/API port`);
    console.log(`UI: ${uiUrl}`);
    console.log(`API: ${apiUrl}`);
    console.warn(
      [
        `Warning: The healthy listener on ${uiConfig.port} is not tracked by ${managedServiceStateStore.path}.`,
        "This start call reused the existing runtime instead of spawning another one.",
        "Use the owning process or port-level tools to stop it; managed stop/restart will not control it automatically."
      ].join(" ")
    );
    await this.printPublicUiUrls(uiConfig.host, uiConfig.port);
    if (open) {
      openBrowser(uiUrl);
    }
  };

  private startNewManagedServiceTarget = async (params: {
    config: Config;
    uiConfig: Config["ui"];
    uiUrl: string;
    apiUrl: string;
    healthUrl: string;
    startupTimeoutMs?: number;
  }): Promise<void> => {
    const { apiUrl, config, healthUrl, startupTimeoutMs, uiConfig, uiUrl } = params;
    const startup = spawnManagedService({
      appName: APP_NAME,
      config,
      uiConfig,
      uiUrl,
      apiUrl,
      healthUrl,
      startupTimeoutMs,
      resolveStartupTimeoutMs: this.resolveStartupTimeoutMs,
      appendStartupStage: this.appendStartupStage,
      printStartupFailureDiagnostics: this.printStartupFailureDiagnostics,
      resolveServiceLogPath
    });
    if (!startup) {
      this.serviceLogger.fatal("managed service startup aborted", {
        reason: "child_process_not_created"
      });
      process.exitCode = 1;
      return;
    }

    const readiness = await waitForManagedServiceReadiness({
      appName: APP_NAME,
      childPid: startup.snapshot.pid,
      healthUrl,
      logPath: startup.logPath,
      readinessTimeoutMs: startup.readinessTimeoutMs,
      quickPhaseTimeoutMs: startup.quickPhaseTimeoutMs,
      extendedPhaseTimeoutMs: startup.extendedPhaseTimeoutMs,
      appendStartupStage: this.appendStartupStage,
      waitForBackgroundServiceReady: this.waitForBackgroundServiceReady,
      isProcessRunning
    });
    if (!readiness.ready && !isProcessRunning(startup.snapshot.pid)) {
      process.exitCode = 1;
      managedServiceStateStore.clear();
      const hint = readiness.lastProbeError ? ` Last probe error: ${readiness.lastProbeError}` : "";
      this.appendStartupStage(startup.logPath, `startup failed: process exited before ready.${hint}`);
      this.serviceLogger.fatal("managed service exited before readiness completed", {
        uiUrl,
        apiUrl,
        healthUrl,
        logPath: startup.logPath,
        ...(readiness.lastProbeError ? { lastProbeError: readiness.lastProbeError } : {}),
      });
      console.error(`Error: Failed to start background service. Check logs: ${startup.logPath}.${hint}`);
      this.printStartupFailureDiagnostics({
        uiUrl,
        apiUrl,
        healthUrl,
        logPath: startup.logPath,
        lastProbeError: readiness.lastProbeError
      });
      return;
    }

    startup.child.unref();
    const state = writeReadyManagedServiceState({
      readinessTimeoutMs: startup.readinessTimeoutMs,
      readiness,
      snapshot: startup.snapshot
    });
    await reportManagedServiceStart({
      appName: APP_NAME,
      state,
      uiConfig,
      uiUrl,
      apiUrl,
      readinessTimeoutMs: startup.readinessTimeoutMs,
      readiness,
      printPublicUiUrls: this.printPublicUiUrls,
      printServiceControlHints: this.printServiceControlHints
    });
  };

  stopService = async (): Promise<void> => {
    const state = managedServiceStateStore.read();
    if (!state) {
      console.log("No running background service found.");
      return;
    }
    if (!isProcessRunning(state.pid)) {
      console.log("Service is not running. Cleaning up state.");
      managedServiceStateStore.clear();
      return;
    }

    console.log(`Stopping ${APP_NAME} (PID ${state.pid})...`);
    try {
      process.kill(state.pid, "SIGTERM");
    } catch (error) {
      console.error(`Failed to stop service: ${String(error)}`);
      return;
    }

    const stopped = await waitForExit(state.pid, 3000);
    if (!stopped) {
      try {
        process.kill(state.pid, "SIGKILL");
      } catch (error) {
        console.error(`Failed to force stop service: ${String(error)}`);
        return;
      }
      await waitForExit(state.pid, 2000);
    }

    managedServiceStateStore.clear();
    localUiRuntimeStore.clearIfOwnedByProcess(state.pid);
    console.log(`✓ ${APP_NAME} stopped`);
  };

  waitForBackgroundServiceReady = async (params: {
    pid: number;
    healthUrl: string;
    timeoutMs: number;
  }): Promise<{ ready: boolean; lastProbeError: string | null }> => {
    const { pid, healthUrl, timeoutMs } = params;
    const startedAt = Date.now();
    let lastProbeError: string | null = null;
    while (Date.now() - startedAt < timeoutMs) {
      if (!isProcessRunning(pid)) {
        return { ready: false, lastProbeError };
      }
      const probe = await probeHealthEndpoint(healthUrl);
      if (!probe.healthy) {
        lastProbeError = probe.error;
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (isProcessRunning(pid)) {
        return { ready: true, lastProbeError: null };
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return { ready: false, lastProbeError };
  };

  private resolveStartupTimeoutMs = (overrideTimeoutMs: number | undefined): number => {
    const fallback = process.platform === "win32" ? 28000 : 33000;
    const envRaw = process.env.NEXTCLAW_START_TIMEOUT_MS?.trim();
    const envValue = envRaw ? Number(envRaw) : Number.NaN;
    const fromEnv = Number.isFinite(envValue) && envValue > 0 ? Math.floor(envValue) : null;
    const fromOverride = Number.isFinite(overrideTimeoutMs) && Number(overrideTimeoutMs) > 0
      ? Math.floor(Number(overrideTimeoutMs))
      : null;
    const resolved = fromOverride ?? fromEnv ?? fallback;
    return Math.max(3000, resolved);
  };

  private appendStartupStage = (logPath: string, message: string): void => {
    try {
      this.serviceLogger.child("startup").info(message, { logPath });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`Warning: failed to write startup diagnostics log (${logPath}): ${detail}`);
    }
  };

  private printStartupFailureDiagnostics = (params: {
    uiUrl: string;
    apiUrl: string;
    healthUrl: string;
    logPath: string;
    lastProbeError: string | null;
  }): void => {
    const statePath = managedServiceStateStore.path;
    const lines = [
      "Startup diagnostics:",
      `- UI URL: ${params.uiUrl}`,
      `- API URL: ${params.apiUrl}`,
      `- Health probe: ${params.healthUrl}`,
      `- Service state path: ${statePath}`,
      `- Startup log path: ${params.logPath}`
    ];
    if (params.lastProbeError) {
      lines.push(`- Last probe detail: ${params.lastProbeError}`);
    }
    console.error(lines.join("\n"));
  };

  private checkUiPortPreflight = async (params: {
    host: string;
    port: number;
    healthUrl: string;
  }): Promise<
    | { ok: true; reusedExistingHealthyTarget: boolean }
    | { ok: false; message: string }
  > => {
    const { healthUrl, host, port } = params;
    const target = await inspectUiTarget({
      host,
      port,
      healthUrl
    });
    if (target.state === "available") {
      return { ok: true, reusedExistingHealthyTarget: false };
    }
    if (target.state === "healthy-existing") {
      return { ok: true, reusedExistingHealthyTarget: true };
    }

    const lines = [
      `Port probe: ${target.availabilityDetail}`
    ];
    if (target.probeError) {
      lines.push(`Health probe: ${target.probeError}`);
    }
    lines.push(
      "The port is occupied by a process that does not answer as a healthy NextClaw HTTP server."
    );
    lines.push(
      `Fix: free port ${port} or start NextClaw with another port via --ui-port <port>.`
    );
    lines.push(
      `Inspect locally with: ss -ltnp | grep ${port} || lsof -iTCP:${port} -sTCP:LISTEN -n -P`
    );
    return {
      ok: false,
      message: lines.join("\n")
    };
  };

  createMissingProvider = (config: ReturnType<typeof loadConfig>): LLMProvider => {
    return this.makeMissingProvider(config);
  };

  createProvider = (config: ReturnType<typeof loadConfig>, options?: { allowMissing?: boolean }): LiteLLMProvider | null => {
    if (options?.allowMissing) {
      return this.makeProvider(config, { allowMissing: true });
    }
    return this.makeProvider(config);
  };

  private makeMissingProvider = (config: ReturnType<typeof loadConfig>): LLMProvider => {
    return new MissingProvider(config.agents.defaults.model);
  };

  private makeProvider = (
    config: ReturnType<typeof loadConfig>,
    options?: { allowMissing?: boolean }
  ): LiteLLMProvider | null => {
    const provider = getProvider(config);
    const model = config.agents.defaults.model;
    if (!provider?.apiKey && !model.startsWith("bedrock/")) {
      if (options?.allowMissing) {
        return null;
      }
      console.error("Error: No API key configured.");
      console.error(`Set one in ${getConfigPath()} under providers section`);
      process.exit(1);
    }
    return new LiteLLMProvider({
      apiKey: provider?.apiKey ?? null,
      apiBase: getApiBase(config),
      defaultModel: model,
      extraHeaders: provider?.extraHeaders ?? null,
      providerName: getProviderName(config),
      wireApi: provider?.wireApi ?? null
    });
  };

  private printPublicUiUrls = async (host: string, port: number): Promise<void> => {
    if (isLoopbackHost(host)) {
      console.log("Public URL: disabled (UI host is loopback). Current release expects public exposure; run nextclaw restart.");
      return;
    }

    const publicIp = await resolvePublicIp();
    if (!publicIp) {
      console.log("Public URL: UI is exposed, but automatic public IP detection failed.");
      return;
    }

    const publicBase = `http://${publicIp}:${port}`;
    console.log(`Public UI (if firewall/NAT allows): ${publicBase}`);
    console.log(`Public API (if firewall/NAT allows): ${publicBase}/api`);
    console.log(
      `Public deploy note: NextClaw serves plain HTTP on ${port}.`
    );
    console.log(
      `For https:// or standard 80/443 access, terminate TLS in Nginx/Caddy and proxy to http://127.0.0.1:${port}.`
    );
    console.log(
      `If a reverse proxy returns 502, verify its upstream is http://127.0.0.1:${port} (not https://, not a stale port, and not a stopped process).`
    );
  };

  private printServiceControlHints = (): void => {
    console.log("Service controls:");
    console.log(`  - Check status: ${APP_NAME} status`);
    console.log(`  - If you need to stop the service, run: ${APP_NAME} stop`);
    console.log(`  - View log paths: ${APP_NAME} logs path`);
    console.log(`  - Tail recent logs: ${APP_NAME} logs tail`);
  };

  private ensureRuntimeLoggingInstalled = (): void => {
    if (this.loggingInstalled) {
      return;
    }
    NextclawCore.configureAppLogging({
      installConsoleMirror: true,
      installProcessCrashMonitor: true
    });
    this.serviceLogger.info("runtime logging ready", {
      startupId: this.loggingRuntime.getStartupId()
    });
    this.loggingInstalled = true;
  };

  private installBuiltinMarketplaceSkill = (slug: string, _force: boolean | undefined): { message: string; output?: string } | null => {
    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    const loader = createSkillsLoader(workspace);
    const builtin = (loader?.listSkills(false) ?? []).find((skill) => skill.name === slug && skill.source === "builtin");

    if (!builtin) {
      return null;
    }
    return {
      message: `${slug} is already available (built-in)`
    };
  };

  private mergeCommandOutput = (stdout: string, stderr: string): string => {
    return `${stdout}\n${stderr}`.trim();
  };

  private runCliSubcommand = (args: string[], timeoutMs = 180_000): Promise<string> => {
    const cliEntry = resolveCliSubcommandEntry({
      argvEntry: process.argv[1],
      importMetaUrl: import.meta.url
    });
    return this.runCommand(process.execPath, [...process.execArgv, cliEntry, ...args], {
      cwd: process.cwd(),
      timeoutMs
    }).then((result) => this.mergeCommandOutput(result.stdout, result.stderr));
  };

  private runCommand = (command: string, args: string[], options: { cwd?: string; timeoutMs?: number } = {}): Promise<{ stdout: string; stderr: string }> => {
    const timeoutMs = options.timeoutMs ?? 180_000;
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(command, args, {
        cwd: options.cwd ?? process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";
      child.stdout?.setEncoding("utf-8");
      child.stderr?.setEncoding("utf-8");
      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
      });

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        rejectPromise(new Error(`command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.on("error", (error) => {
        clearTimeout(timer);
        rejectPromise(new Error(`failed to start command: ${String(error)}`));
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        const output = this.mergeCommandOutput(stdout, stderr);
        if (code === 0) {
          resolvePromise({ stdout, stderr });
          return;
        }
        rejectPromise(new Error(output || `command failed with code ${code ?? 1}`));
      });
    });
  };

}

import * as NextclawCore from "@nextclaw/core";
import {
  resolvePluginChannelMessageToolHints,
  setPluginRuntimeBridge,
  stopPluginChannelGateways
} from "@nextclaw/openclaw-compat";
import { appendFileSync, closeSync, cpSync, existsSync, mkdirSync, openSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { createServer as createNetServer } from "node:net";
import { setImmediate as waitForNextTick } from "node:timers/promises";
import chokidar from "chokidar";
import type { ConfigReloader } from "../config-reloader.js";
import { MissingProvider } from "../missing-provider.js";
import {
  buildServeArgs,
  clearServiceState,
  getPackageVersion,
  isLoopbackHost,
  isProcessRunning,
  openBrowser,
  readServiceState,
  resolveServiceStatePath,
  resolveServiceLogPath,
  resolveUiApiBase,
  resolveUiConfig,
  resolveUiStaticDir,
  resolvePublicIp,
  waitForExit
} from "../utils.js";
import type { RequestRestartParams } from "../types.js";
import { ServiceMarketplaceInstaller } from "./service-marketplace-installer.js";
import { startGatewaySupportServices } from "./service-startup-support.js";
import { consumeRestartSentinel, formatRestartSentinelMessage, parseSessionKey } from "../restart-sentinel.js";
import { resolveCliSubcommandEntry } from "./cli-subcommand-launch.js";
import { writeInitialManagedServiceState, writeReadyManagedServiceState } from "./service-remote-runtime.js";
import { createRemoteAccessHost } from "./service-remote-access.js";
import { type UiNcpAgentHandle } from "./ncp/create-ui-ncp-agent.js";
import { UiSessionService } from "./ncp/ui-session-service.js";
import { createGatewayShellContext, createGatewayStartupContext } from "./service-gateway-context.js";
import {
  runGatewayRuntimeLoop,
  startDeferredGatewayStartup,
  startUiShell,
  wireSystemSessionUpdatedPublisher
} from "./service-gateway-startup.js";
import { createEmptyPluginRegistry } from "./plugin-registry-loader.js";
import {
  configureGatewayPluginRuntime,
  createBootstrapStatus,
  createDeferredGatewayStartupHooks,
  createGatewayRuntimeState,
  type GatewayRuntimeState
} from "./service-gateway-bootstrap.js";
import { logStartupTrace, measureStartupAsync, measureStartupSync } from "../startup-trace.js";

export { buildMarketplaceSkillInstallArgs, pickUserFacingCommandSummary } from "./service-marketplace-helpers.js";
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
  constructor(private deps: { requestRestart: (params: RequestRestartParams) => Promise<void> }) {}

  async startGateway(
    options: { uiOverrides?: Partial<Config["ui"]>; allowMissingProvider?: boolean; uiStaticDir?: string | null } = {}
  ): Promise<void> {
    logStartupTrace("service.start_gateway.begin");
    this.applyLiveConfigReload = null;
    this.liveUiNcpAgent = null;
    const shellContext = measureStartupSync(
      "service.create_gateway_shell_context",
      () => createGatewayShellContext({ uiOverrides: options.uiOverrides, uiStaticDir: options.uiStaticDir })
    );
    const applyLiveConfigReload = async () => { await this.applyLiveConfigReload?.(); };
    let runtimeState: GatewayRuntimeState | null = null;
    const bootstrapStatus = createBootstrapStatus(shellContext.config.remote.enabled);
    const ncpSessionService = new UiSessionService(shellContext.sessionManager, { onSessionUpdated: (sessionKey) => uiStartup?.publish({ type: "session.updated", payload: { sessionKey } }) });

    const marketplaceInstaller = new ServiceMarketplaceInstaller({ applyLiveConfigReload, runCliSubcommand: (args) => this.runCliSubcommand(args), installBuiltinSkill: (slug, force) => this.installBuiltinMarketplaceSkill(slug, force) }).createInstaller();
    const remoteAccess = createRemoteAccessHost({ serviceCommands: this, requestRestart: this.deps.requestRestart, uiConfig: shellContext.uiConfig, remoteModule: shellContext.remoteModule });
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
        getBootstrapStatus: () => bootstrapStatus.getStatus(),
        openBrowserWindow: shellContext.uiConfig.open,
        applyLiveConfigReload,
        ncpSessionService
      })
    );

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
        requestRestart: (params) => this.deps.requestRestart(params)
      })
    );
    this.applyLiveConfigReload = gateway.applyLiveConfigReload;
    const gatewayRuntimeState = createGatewayRuntimeState(gateway);
    runtimeState = gatewayRuntimeState;
    uiStartup?.publish({ type: "config.updated", payload: { path: "channels" } });
    uiStartup?.publish({ type: "config.updated", payload: { path: "plugins" } });
    configureGatewayPluginRuntime({ gateway, state: gatewayRuntimeState, getLiveUiNcpAgent: () => this.liveUiNcpAgent });
    wireSystemSessionUpdatedPublisher({
      runtimePool: gateway.runtimePool,
      publishUiEvent: uiStartup?.publish
    });
    console.log("✓ Capability hydration: scheduled in background");
    await measureStartupAsync("service.start_gateway_support_services", async () =>
      await startGatewaySupportServices({
        cronJobs: gateway.cron.status().jobs,
        remoteModule: gateway.remoteModule,
        watchConfigFile: () => this.watchConfigFile(gateway.reloader),
        startCron: () => gateway.cron.start(),
        startHeartbeat: () => gateway.heartbeat.start()
      })
    );

    const deferredGatewayStartupHooks = createDeferredGatewayStartupHooks({
      uiStartup,
      gateway,
      state: gatewayRuntimeState,
      bootstrapStatus,
      getLiveUiNcpAgent: () => this.liveUiNcpAgent,
      setLiveUiNcpAgent: (ncpAgent) => { this.liveUiNcpAgent = ncpAgent; },
      wakeFromRestartSentinel: async () => {
        await this.wakeFromRestartSentinel({ bus: gateway.bus, sessionManager: gateway.sessionManager });
      }
    });

    logStartupTrace("service.start_gateway.runtime_loop_begin");
    await runGatewayRuntimeLoop({
      runtimePool: gateway.runtimePool,
      startDeferredStartup: () =>
        startDeferredGatewayStartup({
        uiStartup,
        bus: gateway.bus,
        sessionManager: gateway.sessionManager,
        providerManager: gateway.providerManager,
        cronService: gateway.cron,
        gatewayController: gateway.gatewayController,
        getConfig: () => resolveConfigSecrets(loadConfig(), { configPath: gateway.runtimeConfigPath }),
        getExtensionRegistry: () => gatewayRuntimeState.extensionRegistry,
        resolveMessageToolHints: ({ channel, accountId }) => resolvePluginChannelMessageToolHints({
          registry: gatewayRuntimeState.pluginRegistry,
          channel,
          cfg: resolveConfigSecrets(loadConfig(), { configPath: gateway.runtimeConfigPath }),
          accountId,
        }),
        hydrateCapabilities: deferredGatewayStartupHooks.hydrateCapabilities,
        startPluginGateways: deferredGatewayStartupHooks.startPluginGateways,
        startChannels: deferredGatewayStartupHooks.startChannels,
        wakeFromRestartSentinel: deferredGatewayStartupHooks.wakeFromRestartSentinel,
        onNcpAgentReady: deferredGatewayStartupHooks.onNcpAgentReady
      }),
      onDeferredStartupError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        bootstrapStatus.markError(message);
        if (bootstrapStatus.getStatus().pluginHydration.state === "running") {
          bootstrapStatus.markPluginHydrationError(message);
        }
        console.error(`Deferred startup failed: ${error instanceof Error ? error.message : String(error)}`);
      },
      cleanup: async () => {
        this.applyLiveConfigReload = null;
        this.liveUiNcpAgent = null;
        await uiStartup?.deferredNcpAgent.close();
        await gateway.remoteModule?.stop();
        await stopPluginChannelGateways(runtimeState?.pluginGatewayHandles ?? []);
        setPluginRuntimeBridge(null);
      }
    });
    logStartupTrace("service.start_gateway.end");
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private watchConfigFile(reloader: ConfigReloader): void {
    const configPath = resolve(getConfigPath());
    const watcher = chokidar.watch(configPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
    });
    watcher.on("all", (event, changedPath) => {
      if (resolve(changedPath) !== configPath) {
        return;
      }
      if (event === "add") {
        reloader.scheduleReload("config add");
        return;
      }
      if (event === "change") {
        reloader.scheduleReload("config change");
        return;
      }
      if (event === "unlink") {
        reloader.scheduleReload("config unlink");
      }
    });
  }

  private resolveMostRecentRoutableSessionKey(sessionManager: SessionManager): string | undefined {
    const sessions = sessionManager.listSessions();
    let best: { key: string; updatedAt: number } | null = null;

    for (const session of sessions) {
      const key = this.normalizeOptionalString((session as Record<string, unknown>).key);
      if (!key || key.startsWith("cli:")) {
        continue;
      }

      const metadataRaw = (session as Record<string, unknown>).metadata;
      const metadata =
        metadataRaw && typeof metadataRaw === "object" && !Array.isArray(metadataRaw)
          ? (metadataRaw as Record<string, unknown>)
          : {};
      const contextRaw = metadata.last_delivery_context;
      const context =
        contextRaw && typeof contextRaw === "object" && !Array.isArray(contextRaw)
          ? (contextRaw as Record<string, unknown>)
          : {};
      const hasRoute =
        Boolean(this.normalizeOptionalString(context.channel)) && Boolean(this.normalizeOptionalString(context.chatId));
      const hasFallbackRoute =
        Boolean(this.normalizeOptionalString(metadata.last_channel)) && Boolean(this.normalizeOptionalString(metadata.last_to));
      if (!hasRoute && !hasFallbackRoute) {
        continue;
      }

      const updatedAtRaw = this.normalizeOptionalString((session as Record<string, unknown>).updated_at);
      const updatedAt = updatedAtRaw ? Date.parse(updatedAtRaw) : Number.NaN;
      const score = Number.isFinite(updatedAt) ? updatedAt : 0;
      if (!best || score >= best.updatedAt) {
        best = { key, updatedAt: score };
      }
    }

    return best?.key;
  }

  private buildRestartWakePrompt(params: {
    summary: string;
    reason?: string;
    note?: string;
    replyTo?: string;
  }): string {
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
  }

  private async wakeFromRestartSentinel(params: {
    bus: MessageBus;
    sessionManager: SessionManager;
  }): Promise<void> {
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
  }

  async runForeground(options: {
    uiOverrides: Partial<Config["ui"]>;
    open: boolean;
  }): Promise<void> {
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
  }

  async startService(options: {
    uiOverrides: Partial<Config["ui"]>;
    open: boolean;
    startupTimeoutMs?: number;
  }): Promise<void> {
    const config = loadConfig();
    const uiConfig = resolveUiConfig(config, options.uiOverrides);
    const uiUrl = resolveUiApiBase(uiConfig.host, uiConfig.port);
    const apiUrl = `${uiUrl}/api`;
    const staticDir = resolveUiStaticDir();

    const existing = readServiceState();
    if (existing && isProcessRunning(existing.pid)) {
      console.log(`✓ ${APP_NAME} is already running (PID ${existing.pid})`);
      console.log(`UI: ${existing.uiUrl}`);
      console.log(`API: ${existing.apiUrl}`);

      const parsedUi = (() => {
        try {
          const parsed = new URL(existing.uiUrl);
          const port = Number(parsed.port || 80);
          return {
            host: existing.uiHost ?? parsed.hostname,
            port: Number.isFinite(port) ? port : existing.uiPort ?? 55667
          };
        } catch {
          return {
            host: existing.uiHost ?? "127.0.0.1",
            port: existing.uiPort ?? 55667
          };
        }
      })();

      if (parsedUi.host !== uiConfig.host || parsedUi.port !== uiConfig.port) {
        console.log(
          `Detected running service UI bind (${parsedUi.host}:${parsedUi.port}); enforcing (${uiConfig.host}:${uiConfig.port})...`
        );
        await this.stopService();

        const stateAfterStop = readServiceState();
        if (stateAfterStop && isProcessRunning(stateAfterStop.pid)) {
          console.error("Error: Failed to stop running service while enforcing public UI exposure.");
          return;
        }

        return this.startService(options);
      }

      await this.printPublicUiUrls(parsedUi.host, parsedUi.port);
      console.log(`Logs: ${existing.logPath}`);
      this.printServiceControlHints();
      return;
    }
    if (existing) {
      clearServiceState();
    }

    if (!staticDir) {
      return void (process.exitCode = 1, console.error(`Error: ${APP_NAME} UI frontend bundle not found. Reinstall or rebuild ${APP_NAME}. For dev-only overrides, set NEXTCLAW_UI_STATIC_DIR to a built frontend directory.`));
    }

    const healthUrl = `${apiUrl}/health`;
    const portPreflight = await this.checkUiPortPreflight({
      host: uiConfig.host,
      port: uiConfig.port,
      healthUrl
    });
    if (!portPreflight.ok) {
      console.error(`Error: Cannot start ${APP_NAME} because UI port ${uiConfig.port} is already occupied.`);
      console.error(portPreflight.message);
      return;
    }

    const logPath = resolveServiceLogPath();
    const logDir = resolve(logPath, "..");
    mkdirSync(logDir, { recursive: true });
    const logFd = openSync(logPath, "a");
    const readinessTimeoutMs = this.resolveStartupTimeoutMs(options.startupTimeoutMs);
    const quickPhaseTimeoutMs = Math.min(8000, readinessTimeoutMs);
    const extendedPhaseTimeoutMs = Math.max(0, readinessTimeoutMs - quickPhaseTimeoutMs);
    this.appendStartupStage(
      logPath,
      `start requested: ui=${uiConfig.host}:${uiConfig.port}, readinessTimeoutMs=${readinessTimeoutMs}`
    );
    console.log(`Starting ${APP_NAME} background service (readiness timeout ${Math.ceil(readinessTimeoutMs / 1000)}s)...`);

    const serveArgs = buildServeArgs({ uiPort: uiConfig.port });
    this.appendStartupStage(logPath, `spawning background process: ${process.execPath} ${[...process.execArgv, ...serveArgs].join(" ")}`);
    const child = spawn(process.execPath, [...process.execArgv, ...serveArgs], {
      env: process.env,
      stdio: ["ignore", logFd, logFd],
      detached: true
    });
    this.appendStartupStage(logPath, `spawned background process pid=${child.pid ?? "unknown"}`);
    closeSync(logFd);
    if (!child.pid) {
      this.appendStartupStage(logPath, "spawn failed: child pid missing");
      console.error("Error: Failed to start background service.");
      this.printStartupFailureDiagnostics({
        uiUrl,
        apiUrl,
        healthUrl,
        logPath,
        lastProbeError: null
      });
      return;
    }

    writeInitialManagedServiceState({
      config,
      readinessTimeoutMs,
      snapshot: { pid: child.pid, uiUrl, apiUrl, uiHost: uiConfig.host, uiPort: uiConfig.port, logPath }
    });

    this.appendStartupStage(logPath, `health probe started: ${healthUrl} (phase=quick, timeoutMs=${quickPhaseTimeoutMs})`);
    let readiness = await this.waitForBackgroundServiceReady({
      pid: child.pid,
      healthUrl,
      timeoutMs: quickPhaseTimeoutMs
    });

    if (!readiness.ready && isProcessRunning(child.pid) && extendedPhaseTimeoutMs > 0) {
      console.warn(
        `Warning: Background service is still running but not ready after ${Math.ceil(quickPhaseTimeoutMs / 1000)}s; waiting up to ${Math.ceil(extendedPhaseTimeoutMs / 1000)}s more.`
      );
      this.appendStartupStage(
        logPath,
        `health probe entering extended phase (timeoutMs=${extendedPhaseTimeoutMs}, lastError=${readiness.lastProbeError ?? "none"})`
      );
      readiness = await this.waitForBackgroundServiceReady({
        pid: child.pid,
        healthUrl,
        timeoutMs: extendedPhaseTimeoutMs
      });
    }

    if (!readiness.ready) {
      if (!isProcessRunning(child.pid)) {
        clearServiceState();
        const hint = readiness.lastProbeError ? ` Last probe error: ${readiness.lastProbeError}` : "";
        this.appendStartupStage(logPath, `startup failed: process exited before ready.${hint}`);
        console.error(`Error: Failed to start background service. Check logs: ${logPath}.${hint}`);
        this.printStartupFailureDiagnostics({
          uiUrl,
          apiUrl,
          healthUrl,
          logPath,
          lastProbeError: readiness.lastProbeError
        });
        return;
      }
      this.appendStartupStage(
        logPath,
        `startup degraded: process alive but health probe timed out after ${readinessTimeoutMs}ms (lastError=${readiness.lastProbeError ?? "none"})`
      );
    }

    child.unref();

    const state = writeReadyManagedServiceState({
      readinessTimeoutMs,
      readiness,
      snapshot: { pid: child.pid, uiUrl, apiUrl, uiHost: uiConfig.host, uiPort: uiConfig.port, logPath }
    });

    if (!readiness.ready) {
      const hint = readiness.lastProbeError ? ` Last probe error: ${readiness.lastProbeError}` : "";
      console.warn(
        `Warning: ${APP_NAME} is running (PID ${state.pid}) but not healthy yet after ${Math.ceil(readinessTimeoutMs / 1000)}s. Marked as degraded.${hint}`
      );
      console.warn(`Tip: Run "${APP_NAME} status --json" and check logs: ${logPath}`);
    } else {
      console.log(`✓ ${APP_NAME} started in background (PID ${state.pid})`);
    }
    console.log(`UI: ${uiUrl}`);
    console.log(`API: ${apiUrl}`);
    await this.printPublicUiUrls(uiConfig.host, uiConfig.port);
    console.log(`Logs: ${logPath}`);
    this.printServiceControlHints();

    if (options.open) {
      openBrowser(uiUrl);
    }
  }

  async stopService(): Promise<void> {
    const state = readServiceState();
    if (!state) {
      console.log("No running service found.");
      return;
    }
    if (!isProcessRunning(state.pid)) {
      console.log("Service is not running. Cleaning up state.");
      clearServiceState();
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

    clearServiceState();
    console.log(`✓ ${APP_NAME} stopped`);
  }

  async waitForBackgroundServiceReady(params: {
    pid: number;
    healthUrl: string;
    timeoutMs: number;
  }): Promise<{ ready: boolean; lastProbeError: string | null }> {
    const startedAt = Date.now();
    let lastProbeError: string | null = null;
    while (Date.now() - startedAt < params.timeoutMs) {
      if (!isProcessRunning(params.pid)) {
        return { ready: false, lastProbeError };
      }
      const probe = await this.probeHealthEndpoint(params.healthUrl);
      if (!probe.healthy) {
        lastProbeError = probe.error;
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (isProcessRunning(params.pid)) {
        return { ready: true, lastProbeError: null };
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return { ready: false, lastProbeError };
  }

  private resolveStartupTimeoutMs(overrideTimeoutMs: number | undefined): number {
    const fallback = process.platform === "win32" ? 28000 : 33000;
    const envRaw = process.env.NEXTCLAW_START_TIMEOUT_MS?.trim();
    const envValue = envRaw ? Number(envRaw) : Number.NaN;
    const fromEnv = Number.isFinite(envValue) && envValue > 0 ? Math.floor(envValue) : null;
    const fromOverride = Number.isFinite(overrideTimeoutMs) && Number(overrideTimeoutMs) > 0
      ? Math.floor(Number(overrideTimeoutMs))
      : null;
    const resolved = fromOverride ?? fromEnv ?? fallback;
    return Math.max(3000, resolved);
  }

  private appendStartupStage(logPath: string, message: string): void {
    try {
      appendFileSync(logPath, `[${new Date().toISOString()}] [startup] ${message}\n`, "utf-8");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`Warning: failed to write startup diagnostics log (${logPath}): ${detail}`);
    }
  }

  private printStartupFailureDiagnostics(params: {
    uiUrl: string;
    apiUrl: string;
    healthUrl: string;
    logPath: string;
    lastProbeError: string | null;
  }): void {
    const statePath = resolveServiceStatePath();
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
  }

  private async checkUiPortPreflight(params: {
    host: string;
    port: number;
    healthUrl: string;
  }): Promise<{ ok: true } | { ok: false; message: string }> {
    const availability = await this.checkPortAvailability({
      host: params.host,
      port: params.port
    });
    if (availability.available) {
      return { ok: true };
    }

    const probe = await this.probeHealthEndpoint(params.healthUrl);
    const lines = [
      `Port probe: ${availability.detail}`
    ];
    if (probe.healthy) {
      lines.push(
        `Health probe: ${params.healthUrl} is already healthy. Another process is already serving this UI/API port.`
      );
    } else if (probe.error) {
      lines.push(`Health probe: ${probe.error}`);
      lines.push(
        "The port is occupied by a process that does not answer as a healthy NextClaw HTTP server."
      );
    }
    lines.push(
      `Fix: free port ${params.port} or start NextClaw with another port via --ui-port <port>.`
    );
    lines.push(
      `Inspect locally with: ss -ltnp | grep ${params.port} || lsof -iTCP:${params.port} -sTCP:LISTEN -n -P`
    );
    return {
      ok: false,
      message: lines.join("\n")
    };
  }

  private async checkPortAvailability(params: {
    host: string;
    port: number;
  }): Promise<{ available: boolean; detail: string }> {
    return await new Promise((resolve) => {
      const server = createNetServer();
      server.once("error", (error) => {
        resolve({
          available: false,
          detail: `bind failed on ${params.host}:${params.port} (${String(error)})`
        });
      });
      server.listen(params.port, params.host, () => {
        server.close(() => {
          resolve({
            available: true,
            detail: `bind ok on ${params.host}:${params.port}`
          });
        });
      });
    });
  }

  private getHeaderValue(
    headers: Record<string, string | string[] | undefined>,
    key: string
  ): string | null {
    const value = headers[key];
    if (typeof value === "string") {
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    }
    if (Array.isArray(value)) {
      const joined = value.map((item) => item.trim()).filter(Boolean).join(", ");
      return joined.length > 0 ? joined : null;
    }
    return null;
  }

  private formatProbeBodySnippet(raw: string, maxLength = 180): string | null {
    const normalized = raw.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return null;
    }
    const clipped = normalized.length > maxLength
      ? `${normalized.slice(0, maxLength)}...`
      : normalized;
    return JSON.stringify(clipped);
  }

  private async probeHealthEndpoint(
    healthUrl: string
  ): Promise<{ healthy: boolean; error: string | null }> {
    let parsed: URL;
    try {
      parsed = new URL(healthUrl);
    } catch {
      return { healthy: false, error: "invalid health URL" };
    }

    const requestImpl = parsed.protocol === "https:" ? httpsRequest : httpRequest;

    return new Promise((resolve) => {
      const req = requestImpl(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port
            ? Number(parsed.port)
            : parsed.protocol === "https:"
              ? 443
              : 80,
          method: "GET",
          path: `${parsed.pathname}${parsed.search}`,
          timeout: 1000,
          headers: { Accept: "application/json" }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => {
            if (typeof chunk === "string") {
              chunks.push(Buffer.from(chunk));
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () => {
            const responseText = Buffer.concat(chunks).toString("utf-8");
            if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
              const serverHeader = this.getHeaderValue(res.headers, "server");
              const contentType = this.getHeaderValue(res.headers, "content-type");
              const bodySnippet = this.formatProbeBodySnippet(responseText);
              const details = [`http ${res.statusCode ?? "unknown"}`];
              if (serverHeader) {
                details.push(`server=${serverHeader}`);
              }
              if (contentType) {
                details.push(`content-type=${contentType}`);
              }
              if (bodySnippet) {
                details.push(`body=${bodySnippet}`);
              }
              resolve({ healthy: false, error: details.join("; ") });
              return;
            }

            try {
              const payload = JSON.parse(responseText) as {
                ok?: boolean;
                data?: { status?: string };
              };
              const healthy = payload?.ok === true && payload?.data?.status === "ok";
              if (!healthy) {
                resolve({ healthy: false, error: "health payload not ok" });
                return;
              }
              resolve({ healthy: true, error: null });
            } catch {
              resolve({ healthy: false, error: "invalid health JSON response" });
            }
          });
        }
      );

      req.on("timeout", () => {
        req.destroy(new Error("probe timeout"));
      });
      req.on("error", (error) => {
        resolve({ healthy: false, error: error.message || String(error) });
      });
      req.end();
    });
  }

  createMissingProvider(config: ReturnType<typeof loadConfig>): LLMProvider {
    return this.makeMissingProvider(config);
  }

  createProvider(config: ReturnType<typeof loadConfig>, options?: { allowMissing?: boolean }): LiteLLMProvider | null {
    if (options?.allowMissing) {
      return this.makeProvider(config, { allowMissing: true });
    }
    return this.makeProvider(config);
  }

  private makeMissingProvider(config: ReturnType<typeof loadConfig>): LLMProvider {
    return new MissingProvider(config.agents.defaults.model);
  }

  private makeProvider(config: ReturnType<typeof loadConfig>, options: { allowMissing: true }): LiteLLMProvider | null;
  private makeProvider(config: ReturnType<typeof loadConfig>, options?: { allowMissing?: false }): LiteLLMProvider;
  private makeProvider(config: ReturnType<typeof loadConfig>, options?: { allowMissing?: boolean }) {
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
  }

  private async printPublicUiUrls(host: string, port: number): Promise<void> {
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
  }

  private printServiceControlHints(): void {
    console.log("Service controls:");
    console.log(`  - Check status: ${APP_NAME} status`);
    console.log(`  - If you need to stop the service, run: ${APP_NAME} stop`);
  }

  private installBuiltinMarketplaceSkill(
    slug: string,
    force: boolean | undefined
  ): { message: string; output?: string } | null {
    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    const destination = join(workspace, "skills", slug);
    const destinationSkillFile = join(destination, "SKILL.md");

    if (existsSync(destinationSkillFile) && !force) {
      return {
        message: `${slug} is already installed`
      };
    }

    const loader = createSkillsLoader(workspace);
    const builtin = (loader?.listSkills(false) ?? []).find((skill) => skill.name === slug && skill.source === "builtin");

    if (!builtin) {
      if (existsSync(destinationSkillFile)) {
        return {
          message: `${slug} is already installed`
        };
      }
      return null;
    }

    mkdirSync(join(workspace, "skills"), { recursive: true });
    cpSync(dirname(builtin.path), destination, { recursive: true, force: true });
    return {
      message: `Installed skill: ${slug}`
    };
  }

  private mergeCommandOutput(stdout: string, stderr: string): string {
    return `${stdout}\n${stderr}`.trim();
  }

  private runCliSubcommand(args: string[], timeoutMs = 180_000): Promise<string> {
    const cliEntry = resolveCliSubcommandEntry({
      argvEntry: process.argv[1],
      importMetaUrl: import.meta.url
    });
    return this.runCommand(process.execPath, [...process.execArgv, cliEntry, ...args], {
      cwd: process.cwd(),
      timeoutMs
    }).then((result) => this.mergeCommandOutput(result.stdout, result.stderr));
  }

  private runCommand(
    command: string,
    args: string[],
    options: { cwd?: string; timeoutMs?: number } = {}
  ): Promise<{ stdout: string; stderr: string }> {
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
  }

}

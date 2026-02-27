import * as NextclawCore from "@nextclaw/core";
import {
  getPluginChannelBindings,
  resolvePluginChannelMessageToolHints,
  setPluginRuntimeBridge,
  startPluginChannelGateways,
  stopPluginChannelGateways
} from "@nextclaw/openclaw-compat";
import { startUiServer } from "@nextclaw/server";
import { closeSync, cpSync, existsSync, mkdirSync, openSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import chokidar from "chokidar";
import { GatewayControllerImpl } from "../gateway/controller.js";
import { ConfigReloader } from "../config-reloader.js";
import { MissingProvider } from "../missing-provider.js";
import {
  buildServeArgs,
  clearServiceState,
  isLoopbackHost,
  isProcessRunning,
  openBrowser,
  readServiceState,
  resolveServiceLogPath,
  resolveUiApiBase,
  resolveUiConfig,
  resolveUiStaticDir,
  resolvePublicIp,
  waitForExit,
  writeServiceState,
  type ServiceState
} from "../utils.js";
import {
  loadPluginRegistry,
  logPluginDiagnostics,
  mergePluginConfigView,
  toExtensionRegistry,
  toPluginConfigView
} from "./plugins.js";
import type { RequestRestartParams } from "../types.js";
import {
  consumeRestartSentinel,
  formatRestartSentinelMessage,
  parseSessionKey
} from "../restart-sentinel.js";
import { GatewayAgentRuntimePool } from "./agent-runtime-pool.js";

const {
  APP_NAME,
  ChannelManager,
  CronService,
  getApiBase,
  getConfigPath,
  getDataDir,
  getProvider,
  getProviderName,
  getWorkspacePath,
  HeartbeatService,
  LiteLLMProvider,
  loadConfig,
  MessageBus,
  ProviderManager,
  resolveConfigSecrets,
  saveConfig,
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
  constructor(
    private deps: {
      requestRestart: (params: RequestRestartParams) => Promise<void>;
    }
  ) {}

  async startGateway(
    options: { uiOverrides?: Partial<Config["ui"]>; allowMissingProvider?: boolean; uiStaticDir?: string | null } = {}
  ): Promise<void> {
    const runtimeConfigPath = getConfigPath();
    const config = resolveConfigSecrets(loadConfig(), { configPath: runtimeConfigPath });
    const workspace = getWorkspacePath(config.agents.defaults.workspace);
    let pluginRegistry = loadPluginRegistry(config, workspace);
    let extensionRegistry = toExtensionRegistry(pluginRegistry);
    logPluginDiagnostics(pluginRegistry);

    const bus = new MessageBus();
    const provider =
      options.allowMissingProvider === true ? this.makeProvider(config, { allowMissing: true }) : this.makeProvider(config);
    const providerManager = new ProviderManager({
      defaultProvider: provider ?? this.makeMissingProvider(config),
      config
    });
    const sessionManager = new SessionManager(workspace);

    let pluginGatewayHandles: Awaited<ReturnType<typeof startPluginChannelGateways>>["handles"] = [];
    const pluginGatewayLogger = {
      info: (message: string) => console.log(`[plugins] ${message}`),
      warn: (message: string) => console.warn(`[plugins] ${message}`),
      error: (message: string) => console.error(`[plugins] ${message}`),
      debug: (message: string) => console.debug(`[plugins] ${message}`)
    };
    const logPluginGatewayDiagnostics = (
      diagnostics: Awaited<ReturnType<typeof startPluginChannelGateways>>["diagnostics"]
    ): void => {
      for (const diag of diagnostics) {
        const prefix = diag.pluginId ? `${diag.pluginId}: ` : "";
        const text = `${prefix}${diag.message}`;
        if (diag.level === "error") {
          console.error(`[plugins] ${text}`);
        } else {
          console.warn(`[plugins] ${text}`);
        }
      }
    };

    const cronStorePath = join(getDataDir(), "cron", "jobs.json");
    const cron = new CronService(cronStorePath);

    const uiConfig = resolveUiConfig(config, options.uiOverrides);
    const uiStaticDir = options.uiStaticDir === undefined ? resolveUiStaticDir() : options.uiStaticDir;
    if (!provider) {
      console.warn("Warning: No API key configured. The gateway is running, but agent replies are disabled until provider config is set.");
    }

    const channels = new ChannelManager(config, bus, sessionManager, extensionRegistry.channels);
    const reloader = new ConfigReloader({
      initialConfig: config,
      channels,
      bus,
      sessionManager,
      providerManager,
      makeProvider: (nextConfig) => this.makeProvider(nextConfig, { allowMissing: true }) ?? this.makeMissingProvider(nextConfig),
      loadConfig: () => resolveConfigSecrets(loadConfig(), { configPath: runtimeConfigPath }),
      getExtensionChannels: () => extensionRegistry.channels,
      onRestartRequired: (paths) => {
        void this.deps.requestRestart({
          reason: `config reload requires restart: ${paths.join(", ")}`,
          manualMessage: `Config changes require restart: ${paths.join(", ")}`,
          strategy: "background-service-or-manual"
        });
      }
    });
    const gatewayController = new GatewayControllerImpl({
      reloader,
      cron,
      sessionManager,
      getConfigPath,
      saveConfig,
      requestRestart: async (options) => {
        await this.deps.requestRestart({
          reason: options?.reason ?? "gateway tool restart",
          manualMessage: "Restart the gateway to apply changes.",
          strategy: "background-service-or-exit",
          delayMs: options?.delayMs,
          silentOnServiceRestart: true
        });
      }
    });

    const runtimePool = new GatewayAgentRuntimePool({
      bus,
      providerManager,
      sessionManager,
      config,
      cronService: cron,
      restrictToWorkspace: config.tools.restrictToWorkspace,
      braveApiKey: config.tools.web.search.apiKey || undefined,
      execConfig: config.tools.exec,
      contextConfig: config.agents.context,
      gatewayController,
      extensionRegistry,
      resolveMessageToolHints: ({ channel, accountId }) =>
        resolvePluginChannelMessageToolHints({
          registry: pluginRegistry,
          channel,
          cfg: resolveConfigSecrets(loadConfig(), { configPath: runtimeConfigPath }),
          accountId
        })
    });

    reloader.setApplyAgentRuntimeConfig((nextConfig) => runtimePool.applyRuntimeConfig(nextConfig));
    reloader.setReloadPlugins(async (nextConfig) => {
      const nextWorkspace = getWorkspacePath(nextConfig.agents.defaults.workspace);
      const nextPluginRegistry = loadPluginRegistry(nextConfig, nextWorkspace);
      const nextExtensionRegistry = toExtensionRegistry(nextPluginRegistry);
      logPluginDiagnostics(nextPluginRegistry);

      await stopPluginChannelGateways(pluginGatewayHandles);
      const startedPluginGateways = await startPluginChannelGateways({
        registry: nextPluginRegistry,
        logger: pluginGatewayLogger
      });
      pluginGatewayHandles = startedPluginGateways.handles;
      logPluginGatewayDiagnostics(startedPluginGateways.diagnostics);

      pluginRegistry = nextPluginRegistry;
      extensionRegistry = nextExtensionRegistry;
      pluginChannelBindings = getPluginChannelBindings(nextPluginRegistry);
      runtimePool.applyExtensionRegistry(nextExtensionRegistry);
      runtimePool.applyRuntimeConfig(nextConfig);
      console.log("Config reload: plugin channel gateways restarted.");
    });

    let pluginChannelBindings = getPluginChannelBindings(pluginRegistry);
    setPluginRuntimeBridge({
      loadConfig: () =>
        toPluginConfigView(resolveConfigSecrets(loadConfig(), { configPath: runtimeConfigPath }), pluginChannelBindings),
      writeConfigFile: async (nextConfigView) => {
        if (!nextConfigView || typeof nextConfigView !== "object" || Array.isArray(nextConfigView)) {
          throw new Error("plugin runtime writeConfigFile expects an object config");
        }
        const current = loadConfig();
        const next = mergePluginConfigView(current, nextConfigView, pluginChannelBindings);
        saveConfig(next);
      },
      dispatchReplyWithBufferedBlockDispatcher: async ({ ctx, dispatcherOptions }) => {
        const bodyForAgent = typeof ctx.BodyForAgent === "string" ? ctx.BodyForAgent : "";
        const body = typeof ctx.Body === "string" ? ctx.Body : "";
        const content = (bodyForAgent || body).trim();
        if (!content) {
          return;
        }

        const sessionKey =
          typeof ctx.SessionKey === "string" && ctx.SessionKey.trim().length > 0 ? ctx.SessionKey : undefined;
        const channel =
          typeof ctx.OriginatingChannel === "string" && ctx.OriginatingChannel.trim().length > 0
            ? ctx.OriginatingChannel
            : "cli";
        const chatId =
          typeof ctx.OriginatingTo === "string" && ctx.OriginatingTo.trim().length > 0
            ? ctx.OriginatingTo
            : typeof ctx.SenderId === "string" && ctx.SenderId.trim().length > 0
              ? ctx.SenderId
              : "direct";
        const modelOverride =
          typeof (ctx as { Model?: unknown }).Model === "string" && (ctx as { Model?: string }).Model?.trim().length
            ? (ctx as { Model: string }).Model.trim()
            : typeof (ctx as { AgentModel?: unknown }).AgentModel === "string" &&
                (ctx as { AgentModel?: string }).AgentModel?.trim().length
              ? (ctx as { AgentModel: string }).AgentModel.trim()
              : undefined;

        try {
          const response = await runtimePool.processDirect({
            content,
            sessionKey,
            channel,
            chatId,
            agentId:
              typeof (ctx as { AgentId?: unknown }).AgentId === "string"
                ? (ctx as { AgentId: string }).AgentId
                : undefined,
            metadata: {
              ...(typeof ctx.AccountId === "string" && ctx.AccountId.trim().length > 0
                ? { account_id: ctx.AccountId }
                : {}),
              ...(modelOverride ? { model: modelOverride } : {})
            }
          });
          const replyText = typeof response === "string" ? response : String(response ?? "");
          if (replyText.trim()) {
            await dispatcherOptions.deliver({ text: replyText }, { kind: "final" });
          }
        } catch (error) {
          dispatcherOptions.onError?.(error);
          throw error;
        }
      }
    });

    cron.onJob = async (job) => {
      const response = await runtimePool.processDirect({
        content: job.payload.message,
        sessionKey: `cron:${job.id}`,
        channel: job.payload.channel ?? "cli",
        chatId: job.payload.to ?? "direct",
        agentId: runtimePool.primaryAgentId
      });
      if (job.payload.deliver && job.payload.to) {
        await bus.publishOutbound({
          channel: job.payload.channel ?? "cli",
          chatId: job.payload.to,
          content: response,
          media: [],
          metadata: {}
        });
      }
      return response;
    };

    const heartbeat = new HeartbeatService(
      workspace,
      async (promptText) =>
        runtimePool.processDirect({ content: promptText, sessionKey: "heartbeat", agentId: runtimePool.primaryAgentId }),
      30 * 60,
      true
    );
    if (reloader.getChannels().enabledChannels.length) {
      console.log(`✓ Channels enabled: ${reloader.getChannels().enabledChannels.join(", ")}`);
    } else {
      console.log("Warning: No channels enabled");
    }

    this.startUiIfEnabled(uiConfig, uiStaticDir, cron, runtimePool);

    const cronStatus = cron.status();
    if (cronStatus.jobs > 0) {
      console.log(`✓ Cron: ${cronStatus.jobs} scheduled jobs`);
    }
    console.log("✓ Heartbeat: every 30m");

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

    await cron.start();
    await heartbeat.start();

    try {
      const startedPluginGateways = await startPluginChannelGateways({
        registry: pluginRegistry,
        logger: pluginGatewayLogger
      });
      pluginGatewayHandles = startedPluginGateways.handles;
      logPluginGatewayDiagnostics(startedPluginGateways.diagnostics);

      await reloader.getChannels().startAll();
      await this.wakeFromRestartSentinel({ bus, sessionManager });
      await runtimePool.run();
    } finally {
      await stopPluginChannelGateways(pluginGatewayHandles);
      setPluginRuntimeBridge(null);
    }
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
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
            port: Number.isFinite(port) ? port : existing.uiPort ?? 18791
          };
        } catch {
          return {
            host: existing.uiHost ?? "127.0.0.1",
            port: existing.uiPort ?? 18791
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
      console.log(`Stop: ${APP_NAME} stop`);
      return;
    }
    if (existing) {
      clearServiceState();
    }

    if (!staticDir) {
      console.log("Warning: UI frontend not found in package assets.");
    }

    const logPath = resolveServiceLogPath();
    const logDir = resolve(logPath, "..");
    mkdirSync(logDir, { recursive: true });
    const logFd = openSync(logPath, "a");

    const serveArgs = buildServeArgs({
      uiPort: uiConfig.port
    });
    const child = spawn(process.execPath, [...process.execArgv, ...serveArgs], {
      env: process.env,
      stdio: ["ignore", logFd, logFd],
      detached: true
    });
    closeSync(logFd);
    if (!child.pid) {
      console.error("Error: Failed to start background service.");
      return;
    }

    const healthUrl = `${apiUrl}/health`;
    const started = await this.waitForBackgroundServiceReady({
      pid: child.pid,
      healthUrl,
      timeoutMs: 8000
    });

    if (!started) {
      if (isProcessRunning(child.pid)) {
        try {
          process.kill(child.pid, "SIGTERM");
          await waitForExit(child.pid, 2000);
        } catch {
          // Ignore and continue cleanup; process may have already exited.
        }
      }
      clearServiceState();
      console.error(`Error: Failed to start background service. Check logs: ${logPath}`);
      return;
    }

    child.unref();

    const state: ServiceState = {
      pid: child.pid,
      startedAt: new Date().toISOString(),
      uiUrl,
      apiUrl,
      uiHost: uiConfig.host,
      uiPort: uiConfig.port,
      logPath
    };
    writeServiceState(state);

    console.log(`✓ ${APP_NAME} started in background (PID ${state.pid})`);
    console.log(`UI: ${uiUrl}`);
    console.log(`API: ${apiUrl}`);
    await this.printPublicUiUrls(uiConfig.host, uiConfig.port);
    console.log(`Logs: ${logPath}`);
    console.log(`Stop: ${APP_NAME} stop`);

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
  }): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < params.timeoutMs) {
      if (!isProcessRunning(params.pid)) {
        return false;
      }
      try {
        const response = await fetch(params.healthUrl, { method: "GET" });
        if (!response.ok) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          continue;
        }
        const payload = (await response.json()) as { ok?: boolean; data?: { status?: string } };
        const healthy = payload?.ok === true && payload?.data?.status === "ok";
        if (!healthy) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          continue;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (isProcessRunning(params.pid)) {
          return true;
        }
      } catch {
        // Ignore readiness probe errors until timeout.
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return false;
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
  }

  private startUiIfEnabled(
    uiConfig: Config["ui"],
    uiStaticDir: string | null,
    cronService: NextclawCore.CronService,
    runtimePool: GatewayAgentRuntimePool
  ): void {
    if (!uiConfig.enabled) {
      return;
    }
    const uiServer = startUiServer({
      host: uiConfig.host,
      port: uiConfig.port,
      configPath: getConfigPath(),
      staticDir: uiStaticDir ?? undefined,
      cronService,
      marketplace: {
        apiBaseUrl: process.env.NEXTCLAW_MARKETPLACE_API_BASE,
        installer: {
          installPlugin: (spec) => this.installMarketplacePlugin(spec),
          installSkill: (params) => this.installMarketplaceSkill(params),
          enablePlugin: (id) => this.enableMarketplacePlugin(id),
          disablePlugin: (id) => this.disableMarketplacePlugin(id),
          uninstallPlugin: (id) => this.uninstallMarketplacePlugin(id),
          uninstallSkill: (slug) => this.uninstallMarketplaceSkill(slug)
        }
      },
      chatRuntime: {
        processTurn: async (params) => {
          const sessionKey =
            typeof params.sessionKey === "string" && params.sessionKey.trim().length > 0
              ? params.sessionKey.trim()
              : `ui:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
          const inferredAgentId =
            typeof params.agentId === "string" && params.agentId.trim().length > 0
              ? params.agentId.trim()
              : parseAgentScopedSessionKey(sessionKey)?.agentId;
          const model = typeof params.model === "string" && params.model.trim().length > 0 ? params.model.trim() : undefined;
          const metadata =
            params.metadata && typeof params.metadata === "object" && !Array.isArray(params.metadata)
              ? { ...params.metadata }
              : {};
          if (model) {
            metadata.model = model;
          }

          const reply = await runtimePool.processDirect({
            content: params.message,
            sessionKey,
            channel: typeof params.channel === "string" && params.channel.trim().length > 0 ? params.channel : "ui",
            chatId: typeof params.chatId === "string" && params.chatId.trim().length > 0 ? params.chatId : "web-ui",
            agentId: inferredAgentId,
            metadata
          });

          return {
            reply,
            sessionKey,
            ...(inferredAgentId ? { agentId: inferredAgentId } : {}),
            ...(model ? { model } : {})
          };
        }
      }
    });
    const uiUrl = `http://${uiServer.host}:${uiServer.port}`;
    console.log(`✓ UI API: ${uiUrl}/api`);
    if (uiStaticDir) {
      console.log(`✓ UI frontend: ${uiUrl}`);
    }
    void this.printPublicUiUrls(uiServer.host, uiServer.port);
    if (uiConfig.open) {
      openBrowser(uiUrl);
    }
  }

  private async installMarketplacePlugin(spec: string): Promise<{ message: string; output?: string }> {
    const output = await this.runCliSubcommand(["plugins", "install", spec]);
    const summary = this.pickLastOutputLine(output) ?? `Installed plugin: ${spec}`;
    return { message: summary, output };
  }

  private async installMarketplaceSkill(params: {
    slug: string;
    kind?: "npm" | "clawhub" | "git" | "builtin";
    skill?: string;
    installPath?: string;
    version?: string;
    registry?: string;
    force?: boolean;
  }): Promise<{ message: string; output?: string }> {
    if (params.kind === "builtin") {
      const result = this.installBuiltinMarketplaceSkill(params.slug, params.force);
      if (!result) {
        throw new Error(`Builtin skill not found: ${params.slug}`);
      }
      return result;
    }

    if (params.kind === "git") {
      return await this.installGitMarketplaceSkill(params);
    }

    const args = ["skills", "install", params.slug];
    if (params.version) {
      args.push("--version", params.version);
    }
    if (params.registry) {
      args.push("--registry", params.registry);
    }
    if (params.force) {
      args.push("--force");
    }

    try {
      const output = await this.runCliSubcommand(args);
      const summary = this.pickLastOutputLine(output) ?? `Installed skill: ${params.slug}`;
      return { message: summary, output };
    } catch (error) {
      const fallback = this.installBuiltinMarketplaceSkill(params.slug, params.force);
      if (!fallback) {
        throw error;
      }
      return fallback;
    }
  }

  private async installGitMarketplaceSkill(params: {
    slug: string;
    skill?: string;
    installPath?: string;
    registry?: string;
    force?: boolean;
  }): Promise<{ message: string; output?: string }> {
    const source = params.slug.trim();
    if (!source) {
      throw new Error("Git skill source is required");
    }

    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    const skillName = this.resolveGitSkillName(params.skill, source);
    const destination = this.resolveSkillInstallPath(workspace, params.installPath, skillName);
    const destinationSkillFile = join(destination, "SKILL.md");

    if (existsSync(destinationSkillFile) && !params.force) {
      return {
        message: `${skillName} is already installed`,
        output: destination
      };
    }
    if (existsSync(destination) && !params.force) {
      throw new Error(`Skill install path already exists: ${destination} (use force to overwrite)`);
    }

    if (existsSync(destination) && params.force) {
      rmSync(destination, { recursive: true, force: true });
    }

    const skildArgs = ["--yes", "skild", "install", source, "--target", "agents", "--local", "--json", "--skill", skillName];
    if (params.registry) {
      skildArgs.push("--registry", params.registry);
    }
    if (params.force) {
      skildArgs.push("--force");
    }

    let result = await this.runCommandWithFallback(
      ["npx", "/opt/homebrew/bin/npx", "/usr/local/bin/npx"],
      skildArgs,
      {
        cwd: workspace,
        timeoutMs: 180_000
      }
    );

    let payload = this.parseSkildJsonOutput(result.stdout);
    if (!payload) {
      const forceArgs = skildArgs.includes("--force") ? skildArgs : [...skildArgs, "--force"];
      result = await this.runCommandWithFallback(
        ["npx", "/opt/homebrew/bin/npx", "/usr/local/bin/npx"],
        forceArgs,
        {
          cwd: workspace,
          timeoutMs: 180_000
        }
      );
      payload = this.parseSkildJsonOutput(result.stdout);
    }

    if (!payload) {
      throw new Error("skild returned null json payload even after force reinstall");
    }

    const installDir = typeof payload.installDir === "string" ? payload.installDir.trim() : "";
    const installSkillFile = installDir ? join(installDir, "SKILL.md") : "";
    if (!installDir || !existsSync(installSkillFile)) {
      throw new Error(`skild install did not produce a valid skill directory for ${skillName}`);
    }

    mkdirSync(dirname(destination), { recursive: true });
    if (resolve(installDir) !== resolve(destination)) {
      cpSync(installDir, destination, { recursive: true, force: true });
    }
    return {
      message: `Installed skill: ${skillName}`,
      output: [
        `Source: ${source}`,
        `Installed via skild: ${installDir}`,
        `Workspace target: ${destination}`,
        this.mergeCommandOutput(result.stdout, result.stderr)
      ].filter(Boolean).join("\n")
    };
  }

  private async enableMarketplacePlugin(id: string): Promise<{ message: string; output?: string }> {
    const output = await this.runCliSubcommand(["plugins", "enable", id]);
    const summary = this.pickLastOutputLine(output) ?? `Enabled plugin: ${id}`;
    return { message: summary, output };
  }

  private async disableMarketplacePlugin(id: string): Promise<{ message: string; output?: string }> {
    const output = await this.runCliSubcommand(["plugins", "disable", id]);
    const summary = this.pickLastOutputLine(output) ?? `Disabled plugin: ${id}`;
    return { message: summary, output };
  }

  private async uninstallMarketplacePlugin(id: string): Promise<{ message: string; output?: string }> {
    const output = await this.runCliSubcommand(["plugins", "uninstall", id, "--force"]);
    const summary = this.pickLastOutputLine(output) ?? `Uninstalled plugin: ${id}`;
    return { message: summary, output };
  }

  private async uninstallMarketplaceSkill(slug: string): Promise<{ message: string; output?: string }> {
    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    const targetDir = join(workspace, "skills", slug);
    const skildDir = join(workspace, ".agents", "skills", slug);
    const existingTargets = [targetDir, skildDir].filter((path) => existsSync(path));

    if (existingTargets.length === 0) {
      throw new Error(`Skill not installed in workspace: ${slug}`);
    }

    for (const path of existingTargets) {
      rmSync(path, { recursive: true, force: true });
    }

    return {
      message: `Uninstalled skill: ${slug}`,
      output: existingTargets.map((path) => `Removed ${path}`).join("\n")
    };
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
        message: `${slug} is already installed`,
        output: destination
      };
    }

    const loader = createSkillsLoader(workspace);
    const builtin = (loader?.listSkills(false) ?? []).find((skill) => skill.name === slug && skill.source === "builtin");

    if (!builtin) {
      if (existsSync(destinationSkillFile)) {
        return {
          message: `${slug} is already installed`,
          output: destination
        };
      }
      return null;
    }

    mkdirSync(join(workspace, "skills"), { recursive: true });
    cpSync(dirname(builtin.path), destination, { recursive: true, force: true });
    return {
      message: `Installed skill: ${slug}`,
      output: `Copied builtin skill to ${destination}`
    };
  }

  private resolveGitSkillName(skill: string | undefined, source: string): string {
    const fromRequest = typeof skill === "string" ? skill.trim() : "";
    if (fromRequest) {
      return this.validateSkillName(fromRequest);
    }

    const normalizedSource = source.replace(/[?#].*$/, "").replace(/\/+$/, "");
    const parts = normalizedSource.split("/").filter(Boolean);
    const inferred = parts.length > 0 ? parts[parts.length - 1] : "";
    if (!inferred) {
      throw new Error("Git skill install requires a specific skill name");
    }
    return this.validateSkillName(inferred);
  }

  private validateSkillName(skillName: string): string {
    if (!/^[A-Za-z0-9._-]+$/.test(skillName)) {
      throw new Error(`Invalid skill name: ${skillName}`);
    }
    return skillName;
  }

  private resolveSkillInstallPath(workspace: string, installPath: string | undefined, skillName: string): string {
    const requested = typeof installPath === "string" && installPath.trim().length > 0
      ? installPath.trim()
      : join("skills", skillName);
    if (isAbsolute(requested)) {
      throw new Error("installPath must be relative to workspace");
    }

    const destination = resolve(workspace, requested);
    const rel = relative(workspace, destination);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error("installPath escapes workspace");
    }
    return destination;
  }

  private parseSkildJsonOutput(stdout: string): Record<string, unknown> | null {
    const trimmed = stdout.trim();
    if (!trimmed) {
      throw new Error("skild returned empty output");
    }

    const maybeJson = (() => {
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      if (start >= 0 && end > start) {
        return trimmed.slice(start, end + 1);
      }
      return trimmed;
    })();

    try {
      const parsed = JSON.parse(maybeJson);
      if (parsed === null) {
        return null;
      }
      if (Array.isArray(parsed)) {
        const firstObject = parsed.find((item) => item && typeof item === "object" && !Array.isArray(item));
        if (firstObject) {
          return firstObject as Record<string, unknown>;
        }
        throw new Error("skild json output array does not contain an object");
      }
      if (typeof parsed !== "object") {
        throw new Error("skild json output is not an object");
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new Error(`failed to parse skild --json output: ${String(error)}`);
    }
  }

  private mergeCommandOutput(stdout: string, stderr: string): string {
    return `${stdout}\n${stderr}`.trim();
  }

  private runCliSubcommand(args: string[], timeoutMs = 180_000): Promise<string> {
    const cliEntry = fileURLToPath(new URL("../index.js", import.meta.url));
    return this.runCommand(process.execPath, [...process.execArgv, cliEntry, ...args], {
      cwd: process.cwd(),
      timeoutMs
    }).then((result) => this.mergeCommandOutput(result.stdout, result.stderr));
  }

  private async runCommandWithFallback(
    commandCandidates: string[],
    args: string[],
    options: { cwd?: string; timeoutMs?: number } = {}
  ): Promise<{ stdout: string; stderr: string }> {
    let lastError: Error | null = null;
    for (const command of commandCandidates) {
      try {
        return await this.runCommand(command, args, options);
      } catch (error) {
        const message = String(error);
        lastError = error instanceof Error ? error : new Error(message);
        if (message.startsWith("failed to start command:")) {
          continue;
        }
        throw error;
      }
    }
    throw lastError ?? new Error("failed to start command");
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

  private pickLastOutputLine(output: string): string | null {
    const lines = output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.length > 0 ? lines[lines.length - 1] : null;
  }
}

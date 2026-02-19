import {
  APP_NAME,
  AgentLoop,
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
  type LLMProvider,
  loadConfig,
  MessageBus,
  ProviderManager,
  saveConfig,
  SessionManager,
  type Config
} from "@nextclaw/core";
import {
  getPluginChannelBindings,
  resolvePluginChannelMessageToolHints,
  setPluginRuntimeBridge,
  startPluginChannelGateways,
  stopPluginChannelGateways
} from "@nextclaw/openclaw-compat";
import { startUiServer } from "@nextclaw/server";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
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

export class ServiceCommands {
  constructor(
    private deps: {
      requestRestart: (params: RequestRestartParams) => Promise<void>;
    }
  ) {}

  async startGateway(
    options: { uiOverrides?: Partial<Config["ui"]>; allowMissingProvider?: boolean; uiStaticDir?: string | null } = {}
  ): Promise<void> {
    const config = loadConfig();
    const workspace = getWorkspacePath(config.agents.defaults.workspace);
    const pluginRegistry = loadPluginRegistry(config, workspace);
    const extensionRegistry = toExtensionRegistry(pluginRegistry);
    logPluginDiagnostics(pluginRegistry);

    const bus = new MessageBus();
    const provider =
      options.allowMissingProvider === true ? this.makeProvider(config, { allowMissing: true }) : this.makeProvider(config);
    const providerManager = new ProviderManager({
      defaultProvider: provider ?? this.makeMissingProvider(config),
      config
    });
    const sessionManager = new SessionManager(workspace);

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
      loadConfig,
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

    const agent = new AgentLoop({
      bus,
      providerManager,
      workspace,
      model: config.agents.defaults.model,
      maxIterations: config.agents.defaults.maxToolIterations,
      maxTokens: config.agents.defaults.maxTokens,
      braveApiKey: config.tools.web.search.apiKey || undefined,
      execConfig: config.tools.exec,
      cronService: cron,
      restrictToWorkspace: config.tools.restrictToWorkspace,
      sessionManager,
      contextConfig: config.agents.context,
      gatewayController,
      config,
      extensionRegistry,
      resolveMessageToolHints: ({ channel, accountId }) =>
        resolvePluginChannelMessageToolHints({
          registry: pluginRegistry,
          channel,
          cfg: loadConfig(),
          accountId
        })
    });

    reloader.setApplyAgentRuntimeConfig((nextConfig) => agent.applyRuntimeConfig(nextConfig));

    const pluginChannelBindings = getPluginChannelBindings(pluginRegistry);
    setPluginRuntimeBridge({
      loadConfig: () => toPluginConfigView(loadConfig(), pluginChannelBindings),
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
          typeof ctx.SessionKey === "string" && ctx.SessionKey.trim().length > 0
            ? ctx.SessionKey
            : `plugin:${typeof ctx.OriginatingChannel === "string" ? ctx.OriginatingChannel : "channel"}:${typeof ctx.SenderId === "string" ? ctx.SenderId : "unknown"}`;
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
          const response = await agent.processDirect({
            content,
            sessionKey,
            channel,
            chatId,
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
      const response = await agent.processDirect({
        content: job.payload.message,
        sessionKey: `cron:${job.id}`,
        channel: job.payload.channel ?? "cli",
        chatId: job.payload.to ?? "direct"
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
      async (promptText) => agent.processDirect({ content: promptText, sessionKey: "heartbeat" }),
      30 * 60,
      true
    );
    if (reloader.getChannels().enabledChannels.length) {
      console.log(`✓ Channels enabled: ${reloader.getChannels().enabledChannels.join(", ")}`);
    } else {
      console.log("Warning: No channels enabled");
    }

    this.startUiIfEnabled(uiConfig, uiStaticDir);

    const cronStatus = cron.status();
    if (cronStatus.jobs > 0) {
      console.log(`✓ Cron: ${cronStatus.jobs} scheduled jobs`);
    }
    console.log("✓ Heartbeat: every 30m");

    const configPath = getConfigPath();
    const watcher = chokidar.watch(configPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
    });
    watcher.on("add", () => reloader.scheduleReload("config add"));
    watcher.on("change", () => reloader.scheduleReload("config change"));
    watcher.on("unlink", () => reloader.scheduleReload("config unlink"));

    await cron.start();
    await heartbeat.start();

    let pluginGatewayHandles: Awaited<ReturnType<typeof startPluginChannelGateways>>["handles"] = [];
    try {
      const startedPluginGateways = await startPluginChannelGateways({
        registry: pluginRegistry,
        logger: {
          info: (message) => console.log(`[plugins] ${message}`),
          warn: (message) => console.warn(`[plugins] ${message}`),
          error: (message) => console.error(`[plugins] ${message}`),
          debug: (message) => console.debug(`[plugins] ${message}`)
        }
      });
      pluginGatewayHandles = startedPluginGateways.handles;
      for (const diag of startedPluginGateways.diagnostics) {
        const prefix = diag.pluginId ? `${diag.pluginId}: ` : "";
        const text = `${prefix}${diag.message}`;
        if (diag.level === "error") {
          console.error(`[plugins] ${text}`);
        } else {
          console.warn(`[plugins] ${text}`);
        }
      }

      await reloader.getChannels().startAll();
      await this.wakeFromRestartSentinel({ bus, sessionManager });
      await agent.run();
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

    const context = payload.deliveryContext;
    const channel =
      this.normalizeOptionalString(context?.channel) ??
      parsedSession?.channel ??
      this.normalizeOptionalString((params.sessionManager.getIfExists(sessionKey)?.metadata ?? {}).last_channel);
    const chatId =
      this.normalizeOptionalString(context?.chatId) ??
      parsedSession?.chatId ??
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
      ...(replyTo ? { reply_to: replyTo } : {}),
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

  private startUiIfEnabled(uiConfig: Config["ui"], uiStaticDir: string | null): void {
    if (!uiConfig.enabled) {
      return;
    }
    const uiServer = startUiServer({
      host: uiConfig.host,
      port: uiConfig.port,
      configPath: getConfigPath(),
      staticDir: uiStaticDir ?? undefined
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
}

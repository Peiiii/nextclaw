import * as NextclawCore from "@nextclaw/core";
import { resolvePluginChannelMessageToolHints } from "@nextclaw/openclaw-compat";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { setImmediate as waitForNextTick } from "node:timers/promises";
import { MissingProvider } from "@/cli/shared/providers/missing-provider.js";
import { getPackageVersion } from "@/cli/shared/utils/cli.utils.js";
import type { RequestRestartParams } from "@/cli/shared/types/cli.types.js";
import { ServiceMarketplaceInstaller } from "@/cli/shared/services/marketplace/service-marketplace-installer.service.js";
import { ManagedServiceCommandService, resolveSessionRouteCandidate, type StartServiceOptions } from "@/cli/shared/services/runtime/service-managed-startup.service.js";
import { finalizeLocalUiStartup, ServiceFileWatcherRegistry, startGatewayRuntimeSupport, watchServiceConfigFile } from "@/cli/shared/services/gateway/service-startup-support.js";
import { consumeRestartSentinel, formatRestartSentinelMessage, parseSessionKey } from "@/cli/shared/services/restart/restart-sentinel.service.js";
import { createServiceUiHosts } from "@/cli/shared/services/ui/service-ui-hosts.service.js";
import { type UiNcpAgentHandle } from "@/cli/commands/ncp/index.js";
import { createGatewayShellContext, createGatewayStartupContext } from "@/cli/shared/services/gateway/service-gateway-context.service.js";
import { runConfiguredGatewayRuntime, startUiShell } from "@/cli/shared/services/gateway/service-gateway-startup.service.js";
import { createServiceNcpSessionRealtimeBridge } from "@/cli/shared/services/session/service-ncp-session-realtime-bridge.service.js";
import { createEmptyPluginRegistry } from "@/cli/commands/plugin/index.js";
import { configureGatewayPluginRuntime, createBootstrapStatus, createDeferredGatewayStartupHooks, createGatewayRuntimeState, type GatewayRuntimeState } from "@/cli/shared/services/gateway/service-gateway-bootstrap.service.js";
import { cleanupGatewayRuntime, handleGatewayDeferredStartupError } from "@/cli/shared/services/gateway/service-gateway-runtime-lifecycle.service.js";
import { describeUnmanagedHealthyTargetMessage, inspectUiTarget } from "@/cli/shared/utils/service-port-probe.utils.js";
import { logStartupTrace, measureStartupAsync, measureStartupSync } from "@/cli/shared/utils/startup-trace.js";
import { resolveCliSubcommandEntry } from "@/cli/shared/utils/marketplace/cli-subcommand-launch.utils.js";
import { isLoopbackHost, resolvePublicIp } from "@/cli/shared/utils/cli.utils.js";

export { buildMarketplaceSkillInstallArgs, pickUserFacingCommandSummary } from "@/cli/shared/utils/marketplace/service-marketplace-helpers.utils.js";
export { describeUnmanagedHealthyTargetMessage };
const {
  getApiBase,
  getConfigPath,
  getProvider,
  getProviderName,
  getWorkspacePath,
  loadConfig,
  LiteLLMProvider,
  MessageBus,
  resolveConfigSecrets,
  SessionManager,
  parseAgentScopedSessionKey
} = NextclawCore;

type Config = NextclawCore.Config;
type LLMProvider = NextclawCore.LLMProvider;
type LiteLLMProvider = NextclawCore.LiteLLMProvider;
type MessageBus = NextclawCore.MessageBus;
type SessionManager = NextclawCore.SessionManager;
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

export class RuntimeCommandService {
  private applyLiveConfigReload: (() => Promise<void>) | null = null;
  private liveUiNcpAgent: UiNcpAgentHandle | null = null;
  private readonly fileWatchers = new ServiceFileWatcherRegistry();
  private loggingInstalled = false;
  private readonly managedServiceCommandService = new ManagedServiceCommandService({
    startGateway: async (options) => await this.startGateway(options),
    printPublicUiUrls: async (host, port) => await this.printPublicUiUrls(host, port),
    printServiceControlHints: () => this.printServiceControlHints(),
    checkUiPortPreflight: async (params) => await this.checkUiPortPreflight(params)
  });

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
    const marketplaceInstaller = new ServiceMarketplaceInstaller({
      applyLiveConfigReload,
      runCliSubcommand: (args) => this.runCliSubcommand(args),
      installBuiltinSkill: (slug, force) => this.installBuiltinMarketplaceSkill(slug, force)
    }).createInstaller();
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
          ? this.createProvider(config, { allowMissing: true })
          : this.createProvider(config),
        makeMissingProvider: (config) => this.createMissingProvider(config),
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
      bootstrapStatus,
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
    const { note, reason, replyTo, summary } = params;
    const lines = [
      "System event: the gateway has restarted successfully.",
      "Please send one short confirmation to the user that you are back online.",
      "Do not call any tools.",
      "Use the same language as the user's recent conversation.",
      `Reference summary: ${summary}`
    ];

    const normalizedReason = this.normalizeOptionalString(reason);
    if (normalizedReason) {
      lines.push(`Restart reason: ${normalizedReason}`);
    }

    const normalizedNote = this.normalizeOptionalString(note);
    if (normalizedNote) {
      lines.push(`Extra note: ${normalizedNote}`);
    }

    const normalizedReplyTo = this.normalizeOptionalString(replyTo);
    if (normalizedReplyTo) {
      lines.push(`Reply target message id: ${normalizedReplyTo}. If suitable, include [[reply_to:${normalizedReplyTo}]].`);
    }

    return lines.join("\n");
  };

  private wakeFromRestartSentinel = async (params: {
    bus: MessageBus;
    sessionManager: SessionManager;
  }): Promise<void> => {
    const { bus, sessionManager } = params;
    const sentinel = await consumeRestartSentinel();
    if (!sentinel) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));

    const payload = sentinel.payload;
    const summary = formatRestartSentinelMessage(payload);
    const sentinelSessionKey = this.normalizeOptionalString(payload.sessionKey);
    const fallbackSessionKey = sentinelSessionKey ? undefined : this.resolveMostRecentRoutableSessionKey(sessionManager);
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
      this.normalizeOptionalString((sessionManager.getIfExists(sessionKey)?.metadata ?? {}).last_channel);
    const chatId =
      this.normalizeOptionalString(context?.chatId) ??
      parsedSessionRoute?.chatId ??
      this.normalizeOptionalString((sessionManager.getIfExists(sessionKey)?.metadata ?? {}).last_to);
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

    await bus.publishInbound({
      channel: "system",
      senderId: "restart-sentinel",
      chatId: `${channel}:${chatId}`,
      content: prompt,
      timestamp: new Date(),
      attachments: [],
      metadata
    });
  };

  startService = async (options: StartServiceOptions): Promise<void> => {
    await this.managedServiceCommandService.startService(options);
  };

  stopService = async (): Promise<void> => {
    await this.managedServiceCommandService.stopService();
  };

  runForeground = async (options: {
    uiOverrides: Partial<Config["ui"]>;
    open: boolean;
  }): Promise<void> => {
    await this.managedServiceCommandService.runForeground(options);
  };

  createMissingProvider = (config: ReturnType<typeof loadConfig>): LLMProvider => {
    return new MissingProvider(config.agents.defaults.model);
  };

  createProvider = (config: ReturnType<typeof loadConfig>, options?: { allowMissing?: boolean }): LiteLLMProvider | null => {
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

  private ensureRuntimeLoggingInstalled = (): void => {
    if (this.loggingInstalled) {
      return;
    }
    NextclawCore.configureAppLogging({
      installConsoleMirror: true,
      installProcessCrashMonitor: true
    });
    this.loggingInstalled = true;
  };

  private checkUiPortPreflight = async (params: {
    host: string;
    port: number;
    healthUrl: string;
  }): Promise<
    | { ok: true; reusedExistingHealthyTarget: boolean }
    | { ok: false; message: string }
  > => {
    const target = await inspectUiTarget(params);
    if (target.state === "available") {
      return { ok: true, reusedExistingHealthyTarget: false };
    }
    if (target.state === "healthy-existing") {
      return { ok: true, reusedExistingHealthyTarget: true };
    }

    const lines = [`Port probe: ${target.availabilityDetail}`];
    if (target.probeError) {
      lines.push(`Health probe: ${target.probeError}`);
    }
    lines.push("The port is occupied by a process that does not answer as a healthy NextClaw HTTP server.");
    lines.push(`Fix: free port ${params.port} or start NextClaw with another port via --ui-port <port>.`);
    lines.push(`Inspect locally with: ss -ltnp | grep ${params.port} || lsof -iTCP:${params.port} -sTCP:LISTEN -n -P`);
    return {
      ok: false,
      message: lines.join("\n")
    };
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
    console.log(`Public deploy note: NextClaw serves plain HTTP on ${port}.`);
    console.log(`For https:// or standard 80/443 access, terminate TLS in Nginx/Caddy and proxy to http://127.0.0.1:${port}.`);
    console.log(`If a reverse proxy returns 502, verify its upstream is http://127.0.0.1:${port} (not https://, not a stale port, and not a stopped process).`);
  };

  private printServiceControlHints = (): void => {
    console.log("Service controls:");
    console.log("  - Check status: NextClaw status");
    console.log("  - If you need to stop the service, run: NextClaw stop");
    console.log("  - View log paths: NextClaw logs path");
    console.log("  - Tail recent logs: NextClaw logs tail");
    console.log("  - Check autostart: NextClaw service autostart status --user");
  };
}

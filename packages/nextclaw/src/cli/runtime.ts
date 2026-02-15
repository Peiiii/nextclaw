import {
  loadConfig,
  saveConfig,
  getConfigPath,
  getDataDir,
  ConfigSchema,
  getApiBase,
  getProvider,
  getProviderName,
  type Config,
  buildReloadPlan,
  diffConfigPaths,
  getWorkspacePath,
  MessageBus,
  AgentLoop,
  LiteLLMProvider,
  ProviderManager,
  ChannelManager,
  SessionManager,
  CronService,
  HeartbeatService,
  PROVIDERS,
  APP_NAME
} from "nextclaw-core";
import { startUiServer } from "nextclaw-server";
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import chokidar from "chokidar";
import type { ServiceState } from "./utils.js";
import {
  buildServeArgs,
  clearServiceState,
  findAvailablePort,
  getPackageVersion,
  isDevRuntime,
  isProcessRunning,
  openBrowser,
  printAgentResponse,
  prompt,
  readServiceState,
  resolveServiceLogPath,
  resolveUiApiBase,
  resolveUiConfig,
  resolveUiFrontendDir,
  resolveUiStaticDir,
  startUiFrontend,
  waitForExit,
  which,
  writeServiceState
} from "./utils.js";

export const LOGO = "🤖";

const EXIT_COMMANDS = new Set(["exit", "quit", "/exit", "/quit", ":q"]);

type GatewayCommandOptions = {
  ui?: boolean;
  uiHost?: string;
  uiPort?: string | number;
  uiOpen?: boolean;
};

type UiCommandOptions = {
  host?: string;
  port?: string | number;
  open?: boolean;
};

type StartCommandOptions = {
  uiHost?: string;
  uiPort?: string | number;
  frontend?: boolean;
  frontendPort?: string | number;
  open?: boolean;
};

type AgentCommandOptions = {
  message?: string;
  session?: string;
  markdown?: boolean;
};

type CronAddOptions = {
  name: string;
  message: string;
  every?: string;
  cron?: string;
  at?: string;
  deliver?: boolean;
  to?: string;
  channel?: string;
};

export class CliRuntime {
  private logo: string;

  constructor(options: { logo?: string } = {}) {
    this.logo = options.logo ?? LOGO;
  }

  get version(): string {
    return getPackageVersion();
  }

  async onboard(): Promise<void> {
    const configPath = getConfigPath();
    if (existsSync(configPath)) {
      console.log(`Config already exists at ${configPath}`);
    }
    const config = ConfigSchema.parse({});
    saveConfig(config);
    console.log(`✓ Created config at ${configPath}`);

    const workspace = getWorkspacePath();
    console.log(`✓ Created workspace at ${workspace}`);
    this.createWorkspaceTemplates(workspace);

    console.log(`\n${this.logo} ${APP_NAME} is ready!`);
    console.log("\nNext steps:");
    console.log(`  1. Add your API key to ${configPath}`);
    console.log(`  2. Chat: ${APP_NAME} agent -m "Hello!"`);
  }

  async gateway(opts: GatewayCommandOptions): Promise<void> {
    const uiOverrides: Partial<Config["ui"]> = {};
    if (opts.ui) {
      uiOverrides.enabled = true;
    }
    if (opts.uiHost) {
      uiOverrides.host = String(opts.uiHost);
    }
    if (opts.uiPort) {
      uiOverrides.port = Number(opts.uiPort);
    }
    if (opts.uiOpen) {
      uiOverrides.open = true;
    }
    await this.startGateway({ uiOverrides });
  }

  async ui(opts: UiCommandOptions): Promise<void> {
    const uiOverrides: Partial<Config["ui"]> = {
      enabled: true,
      open: Boolean(opts.open)
    };
    if (opts.host) {
      uiOverrides.host = String(opts.host);
    }
    if (opts.port) {
      uiOverrides.port = Number(opts.port);
    }
    await this.startGateway({ uiOverrides, allowMissingProvider: true });
  }

  async start(opts: StartCommandOptions): Promise<void> {
    const uiOverrides: Partial<Config["ui"]> = {
      enabled: true,
      open: false
    };
    if (opts.uiHost) {
      uiOverrides.host = String(opts.uiHost);
    }
    if (opts.uiPort) {
      uiOverrides.port = Number(opts.uiPort);
    }

    const devMode = isDevRuntime();
    if (devMode) {
      const requestedUiPort = Number.isFinite(Number(opts.uiPort)) ? Number(opts.uiPort) : 18792;
      const requestedFrontendPort = Number.isFinite(Number(opts.frontendPort)) ? Number(opts.frontendPort) : 5174;
      const uiHost = uiOverrides.host ?? "127.0.0.1";
      const devUiPort = await findAvailablePort(requestedUiPort, uiHost);
      const shouldStartFrontend = opts.frontend === undefined ? true : Boolean(opts.frontend);
      const devFrontendPort = shouldStartFrontend
        ? await findAvailablePort(requestedFrontendPort, "127.0.0.1")
        : requestedFrontendPort;
      uiOverrides.port = devUiPort;
      if (requestedUiPort !== devUiPort) {
        console.log(`Dev mode: UI port ${requestedUiPort} is in use, switched to ${devUiPort}.`);
      }
      if (shouldStartFrontend && requestedFrontendPort !== devFrontendPort) {
        console.log(`Dev mode: Frontend port ${requestedFrontendPort} is in use, switched to ${devFrontendPort}.`);
      }
      console.log(`Dev mode: UI ${devUiPort}, Frontend ${devFrontendPort}`);
      console.log("Dev mode runs in the foreground (Ctrl+C to stop).");
      await this.runForeground({
        uiOverrides,
        frontend: shouldStartFrontend,
        frontendPort: devFrontendPort,
        open: Boolean(opts.open)
      });
      return;
    }

    await this.startService({
      uiOverrides,
      frontend: Boolean(opts.frontend),
      frontendPort: Number(opts.frontendPort),
      open: Boolean(opts.open)
    });
  }

  async serve(opts: StartCommandOptions): Promise<void> {
    const uiOverrides: Partial<Config["ui"]> = {
      enabled: true,
      open: false
    };
    if (opts.uiHost) {
      uiOverrides.host = String(opts.uiHost);
    }
    if (opts.uiPort) {
      uiOverrides.port = Number(opts.uiPort);
    }

    const devMode = isDevRuntime();
    if (devMode && uiOverrides.port === undefined) {
      uiOverrides.port = 18792;
    }

    const shouldStartFrontend = Boolean(opts.frontend);
    const defaultFrontendPort = devMode ? 5174 : 5173;
    const requestedFrontendPort = Number.isFinite(Number(opts.frontendPort))
      ? Number(opts.frontendPort)
      : defaultFrontendPort;
    if (devMode && uiOverrides.port !== undefined) {
      const uiHost = uiOverrides.host ?? "127.0.0.1";
      const uiPort = await findAvailablePort(uiOverrides.port, uiHost);
      if (uiPort !== uiOverrides.port) {
        console.log(`Dev mode: UI port ${uiOverrides.port} is in use, switched to ${uiPort}.`);
        uiOverrides.port = uiPort;
      }
    }
    const frontendPort =
      devMode && shouldStartFrontend ? await findAvailablePort(requestedFrontendPort, "127.0.0.1") : requestedFrontendPort;
    if (devMode && shouldStartFrontend && frontendPort !== requestedFrontendPort) {
      console.log(`Dev mode: Frontend port ${requestedFrontendPort} is in use, switched to ${frontendPort}.`);
    }
    await this.runForeground({
      uiOverrides,
      frontend: shouldStartFrontend,
      frontendPort,
      open: Boolean(opts.open)
    });
  }

  async stop(): Promise<void> {
    await this.stopService();
  }

  async agent(opts: AgentCommandOptions): Promise<void> {
    const config = loadConfig();
    const bus = new MessageBus();
    const provider = this.makeProvider(config);
    const providerManager = new ProviderManager(provider);
    const agentLoop = new AgentLoop({
      bus,
      providerManager,
      workspace: getWorkspacePath(config.agents.defaults.workspace),
      braveApiKey: config.tools.web.search.apiKey || undefined,
      execConfig: config.tools.exec,
      restrictToWorkspace: config.tools.restrictToWorkspace
    });

    if (opts.message) {
      const response = await agentLoop.processDirect({
        content: opts.message,
        sessionKey: opts.session ?? "cli:default",
        channel: "cli",
        chatId: "direct"
      });
      printAgentResponse(response);
      return;
    }

    console.log(`${this.logo} Interactive mode (type exit or Ctrl+C to quit)\n`);
    const historyFile = join(getDataDir(), "history", "cli_history");
    const historyDir = resolve(historyFile, "..");
    mkdirSync(historyDir, { recursive: true });

    const history = existsSync(historyFile) ? readFileSync(historyFile, "utf-8").split("\n").filter(Boolean) : [];
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.on("close", () => {
      const merged = history.concat((rl as unknown as { history: string[] }).history ?? []);
      writeFileSync(historyFile, merged.join("\n"));
      process.exit(0);
    });

    let running = true;
    while (running) {
      const line = await prompt(rl, "You: ");
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      if (EXIT_COMMANDS.has(trimmed.toLowerCase())) {
        rl.close();
        running = false;
        break;
      }
      const response = await agentLoop.processDirect({
        content: trimmed,
        sessionKey: opts.session ?? "cli:default"
      });
      printAgentResponse(response);
    }
  }

  channelsStatus(): void {
    const config = loadConfig();
    console.log("Channel Status");
    console.log(`WhatsApp: ${config.channels.whatsapp.enabled ? "✓" : "✗"}`);
    console.log(`Discord: ${config.channels.discord.enabled ? "✓" : "✗"}`);
    console.log(`Feishu: ${config.channels.feishu.enabled ? "✓" : "✗"}`);
    console.log(`Mochat: ${config.channels.mochat.enabled ? "✓" : "✗"}`);
    console.log(`Telegram: ${config.channels.telegram.enabled ? "✓" : "✗"}`);
    console.log(`Slack: ${config.channels.slack.enabled ? "✓" : "✗"}`);
    console.log(`QQ: ${config.channels.qq.enabled ? "✓" : "✗"}`);
  }

  channelsLogin(): void {
    const bridgeDir = this.getBridgeDir();
    console.log(`${this.logo} Starting bridge...`);
    console.log("Scan the QR code to connect.\n");
    const result = spawnSync("npm", ["start"], { cwd: bridgeDir, stdio: "inherit" });
    if (result.status !== 0) {
      console.error(`Bridge failed: ${result.status ?? 1}`);
    }
  }

  cronList(opts: { all?: boolean }): void {
    const storePath = join(getDataDir(), "cron", "jobs.json");
    const service = new CronService(storePath);
    const jobs = service.listJobs(Boolean(opts.all));
    if (!jobs.length) {
      console.log("No scheduled jobs.");
      return;
    }
    for (const job of jobs) {
      let schedule = "";
      if (job.schedule.kind === "every") {
        schedule = `every ${Math.round((job.schedule.everyMs ?? 0) / 1000)}s`;
      } else if (job.schedule.kind === "cron") {
        schedule = job.schedule.expr ?? "";
      } else {
        schedule = job.schedule.atMs ? new Date(job.schedule.atMs).toISOString() : "";
      }
      console.log(`${job.id} ${job.name} ${schedule}`);
    }
  }

  cronAdd(opts: CronAddOptions): void {
    const storePath = join(getDataDir(), "cron", "jobs.json");
    const service = new CronService(storePath);
    let schedule: { kind: "every" | "cron" | "at"; everyMs?: number; expr?: string; atMs?: number } | null = null;
    if (opts.every) {
      schedule = { kind: "every", everyMs: Number(opts.every) * 1000 };
    } else if (opts.cron) {
      schedule = { kind: "cron", expr: String(opts.cron) };
    } else if (opts.at) {
      schedule = { kind: "at", atMs: Date.parse(String(opts.at)) };
    }
    if (!schedule) {
      console.error("Error: Must specify --every, --cron, or --at");
      return;
    }
    const job = service.addJob({
      name: opts.name,
      schedule,
      message: opts.message,
      deliver: Boolean(opts.deliver),
      channel: opts.channel,
      to: opts.to
    });
    console.log(`✓ Added job '${job.name}' (${job.id})`);
  }

  cronRemove(jobId: string): void {
    const storePath = join(getDataDir(), "cron", "jobs.json");
    const service = new CronService(storePath);
    if (service.removeJob(jobId)) {
      console.log(`✓ Removed job ${jobId}`);
    } else {
      console.log(`Job ${jobId} not found`);
    }
  }

  cronEnable(jobId: string, opts: { disable?: boolean }): void {
    const storePath = join(getDataDir(), "cron", "jobs.json");
    const service = new CronService(storePath);
    const job = service.enableJob(jobId, !opts.disable);
    if (job) {
      console.log(`✓ Job '${job.name}' ${opts.disable ? "disabled" : "enabled"}`);
    } else {
      console.log(`Job ${jobId} not found`);
    }
  }

  async cronRun(jobId: string, opts: { force?: boolean }): Promise<void> {
    const storePath = join(getDataDir(), "cron", "jobs.json");
    const service = new CronService(storePath);
    const ok = await service.runJob(jobId, Boolean(opts.force));
    console.log(ok ? "✓ Job executed" : `Failed to run job ${jobId}`);
  }

  status(): void {
    const configPath = getConfigPath();
    const config = loadConfig();
    const workspace = getWorkspacePath(config.agents.defaults.workspace);
    console.log(`${this.logo} ${APP_NAME} Status\n`);
    console.log(`Config: ${configPath} ${existsSync(configPath) ? "✓" : "✗"}`);
    console.log(`Workspace: ${workspace} ${existsSync(workspace) ? "✓" : "✗"}`);
    console.log(`Model: ${config.agents.defaults.model}`);
    for (const spec of PROVIDERS) {
      const provider = (config.providers as Record<string, { apiKey?: string; apiBase?: string }>)[spec.name];
      if (!provider) {
        continue;
      }
      if (spec.isLocal) {
        console.log(`${spec.displayName ?? spec.name}: ${provider.apiBase ? `✓ ${provider.apiBase}` : "not set"}`);
      } else {
        console.log(`${spec.displayName ?? spec.name}: ${provider.apiKey ? "✓" : "not set"}`);
      }
    }
  }

  private async startGateway(
    options: { uiOverrides?: Partial<Config["ui"]>; allowMissingProvider?: boolean; uiStaticDir?: string | null } = {}
  ): Promise<void> {
    const config = loadConfig();
    const bus = new MessageBus();
    const provider =
      options.allowMissingProvider === true ? this.makeProvider(config, { allowMissing: true }) : this.makeProvider(config);
    const providerManager = provider ? new ProviderManager(provider) : null;
    const sessionManager = new SessionManager(getWorkspacePath(config.agents.defaults.workspace));

    const cronStorePath = join(getDataDir(), "cron", "jobs.json");
    const cron = new CronService(cronStorePath);

    const uiConfig = resolveUiConfig(config, options.uiOverrides);
    const uiStaticDir = options.uiStaticDir === undefined ? resolveUiStaticDir() : options.uiStaticDir;
    if (!provider) {
      if (uiConfig.enabled) {
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
        if (uiConfig.open) {
          openBrowser(uiUrl);
        }
      }
      console.log("Warning: No API key configured. UI server only.");
      await new Promise(() => {});
      return;
    }

    const agent = new AgentLoop({
      bus,
      providerManager: providerManager ?? new ProviderManager(provider),
      workspace: getWorkspacePath(config.agents.defaults.workspace),
      model: config.agents.defaults.model,
      maxIterations: config.agents.defaults.maxToolIterations,
      braveApiKey: config.tools.web.search.apiKey || undefined,
      execConfig: config.tools.exec,
      cronService: cron,
      restrictToWorkspace: config.tools.restrictToWorkspace,
      sessionManager
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
      getWorkspacePath(config.agents.defaults.workspace),
      async (promptText) => agent.processDirect({ content: promptText, sessionKey: "heartbeat" }),
      30 * 60,
      true
    );

    let currentConfig = config;
    let channels = new ChannelManager(currentConfig, bus, sessionManager);
    let reloadTask: Promise<void> | null = null;
    const reloadChannels = async (nextConfig: Config): Promise<void> => {
      if (reloadTask) {
        await reloadTask;
        return;
      }
      reloadTask = (async () => {
        await channels.stopAll();
        channels = new ChannelManager(nextConfig, bus, sessionManager);
        await channels.startAll();
      })();
      try {
        await reloadTask;
      } finally {
        reloadTask = null;
      }
    };
    let providerReloadTask: Promise<void> | null = null;
    const reloadProvider = async (nextConfig: Config): Promise<void> => {
      if (!providerManager) {
        return;
      }
      if (providerReloadTask) {
        await providerReloadTask;
        return;
      }
      providerReloadTask = (async () => {
        const nextProvider = this.makeProvider(nextConfig, { allowMissing: true });
        if (!nextProvider) {
          console.warn("Provider reload skipped: missing API key.");
          return;
        }
        providerManager.set(nextProvider);
      })();
      try {
        await providerReloadTask;
      } finally {
        providerReloadTask = null;
      }
    };
    const applyReloadPlan = async (nextConfig: Config): Promise<void> => {
      const changedPaths = diffConfigPaths(currentConfig, nextConfig);
      if (!changedPaths.length) {
        return;
      }
      currentConfig = nextConfig;
      const plan = buildReloadPlan(changedPaths);
      if (plan.restartChannels) {
        await reloadChannels(nextConfig);
      }
      if (plan.reloadProviders) {
        await reloadProvider(nextConfig);
      }
      if (plan.restartRequired.length > 0) {
        console.warn(`Config changes require restart: ${plan.restartRequired.join(", ")}`);
      }
    };

    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    let reloadRunning = false;
    let reloadPending = false;
    const scheduleConfigReload = (reason: string): void => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
      }
      reloadTimer = setTimeout(() => {
        void runConfigReload(reason);
      }, 300);
    };

    const runConfigReload = async (reason: string): Promise<void> => {
      if (reloadRunning) {
        reloadPending = true;
        return;
      }
      reloadRunning = true;
      if (reloadTimer) {
        clearTimeout(reloadTimer);
        reloadTimer = null;
      }
      try {
        const nextConfig = loadConfig();
        await applyReloadPlan(nextConfig);
      } catch (error) {
        console.error(`Config reload failed (${reason}): ${String(error)}`);
      } finally {
        reloadRunning = false;
        if (reloadPending) {
          reloadPending = false;
          scheduleConfigReload("pending");
        }
      }
    };
    if (channels.enabledChannels.length) {
      console.log(`✓ Channels enabled: ${channels.enabledChannels.join(", ")}`);
    } else {
      console.log("Warning: No channels enabled");
    }

    if (uiConfig.enabled) {
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
      if (uiConfig.open) {
        openBrowser(uiUrl);
      }
    }

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
    watcher.on("add", () => scheduleConfigReload("config add"));
    watcher.on("change", () => scheduleConfigReload("config change"));
    watcher.on("unlink", () => scheduleConfigReload("config unlink"));

    await cron.start();
    await heartbeat.start();

    await Promise.allSettled([agent.run(), channels.startAll()]);
  }

  private async runForeground(options: {
    uiOverrides: Partial<Config["ui"]>;
    frontend: boolean;
    frontendPort: number;
    open: boolean;
  }): Promise<void> {
    const config = loadConfig();
    const uiConfig = resolveUiConfig(config, options.uiOverrides);
    const shouldStartFrontend = options.frontend;
    const frontendPort = Number.isFinite(options.frontendPort) ? options.frontendPort : 5173;
    const frontendDir = shouldStartFrontend ? resolveUiFrontendDir() : null;
    const staticDir = resolveUiStaticDir();

    let frontendUrl: string | null = null;
    if (shouldStartFrontend && frontendDir) {
      const frontend = startUiFrontend({
        apiBase: resolveUiApiBase(uiConfig.host, uiConfig.port),
        port: frontendPort,
        dir: frontendDir
      });
      frontendUrl = frontend?.url ?? null;
    } else if (shouldStartFrontend && !frontendDir) {
      console.log("Warning: UI frontend not found. Start it separately.");
    }
    if (!frontendUrl && staticDir) {
      frontendUrl = resolveUiApiBase(uiConfig.host, uiConfig.port);
    }

    if (options.open && frontendUrl) {
      openBrowser(frontendUrl);
    } else if (options.open && !frontendUrl) {
      console.log("Warning: UI frontend not started. Browser not opened.");
    }

    const uiStaticDir = shouldStartFrontend && frontendDir ? null : staticDir;
    await this.startGateway({
      uiOverrides: options.uiOverrides,
      allowMissingProvider: true,
      uiStaticDir
    });
  }

  private async startService(options: {
    uiOverrides: Partial<Config["ui"]>;
    frontend: boolean;
    frontendPort: number;
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
      console.log(`Logs: ${existing.logPath}`);
      console.log(`Stop: ${APP_NAME} stop`);
      return;
    }
    if (existing) {
      clearServiceState();
    }

    if (!staticDir && !options.frontend) {
      console.log("Warning: UI frontend not found. Use --frontend to start the dev server.");
    }

    const logPath = resolveServiceLogPath();
    const logDir = resolve(logPath, "..");
    mkdirSync(logDir, { recursive: true });
    const logFd = openSync(logPath, "a");

    const serveArgs = buildServeArgs({
      uiHost: uiConfig.host,
      uiPort: uiConfig.port,
      frontend: options.frontend,
      frontendPort: options.frontendPort
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
    child.unref();

    const state: ServiceState = {
      pid: child.pid,
      startedAt: new Date().toISOString(),
      uiUrl,
      apiUrl,
      logPath
    };
    writeServiceState(state);

    console.log(`✓ ${APP_NAME} started in background (PID ${state.pid})`);
    console.log(`UI: ${uiUrl}`);
    console.log(`API: ${apiUrl}`);
    console.log(`Logs: ${logPath}`);
    console.log(`Stop: ${APP_NAME} stop`);

    if (options.open) {
      openBrowser(uiUrl);
    }
  }

  private async stopService(): Promise<void> {
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

  private createWorkspaceTemplates(workspace: string): void {
    const templates: Record<string, string> = {
      "AGENTS.md": "# Agent Instructions\n\nYou are a helpful AI assistant. Be concise, accurate, and friendly.\n\n## Guidelines\n\n- Always explain what you're doing before taking actions\n- Ask for clarification when the request is ambiguous\n- Use tools to help accomplish tasks\n- Remember important information in your memory files\n",
      "SOUL.md": `# Soul\n\nI am ${APP_NAME}, a lightweight AI assistant.\n\n## Personality\n\n- Helpful and friendly\n- Concise and to the point\n- Curious and eager to learn\n\n## Values\n\n- Accuracy over speed\n- User privacy and safety\n- Transparency in actions\n\n`,
      "USER.md": "# User\n\nInformation about the user goes here.\n\n## Preferences\n\n- Communication style: (casual/formal)\n- Timezone: (your timezone)\n- Language: (your preferred language)\n"
    };

    for (const [filename, content] of Object.entries(templates)) {
      const filePath = join(workspace, filename);
      if (!existsSync(filePath)) {
        writeFileSync(filePath, content);
      }
    }

    const memoryDir = join(workspace, "memory");
    mkdirSync(memoryDir, { recursive: true });
    const memoryFile = join(memoryDir, "MEMORY.md");
    if (!existsSync(memoryFile)) {
      writeFileSync(
        memoryFile,
        "# Long-term Memory\n\nThis file stores important information that should persist across sessions.\n\n## User Information\n\n(Important facts about the user)\n\n## Preferences\n\n(User preferences learned over time)\n\n## Important Notes\n\n(Things to remember)\n"
      );
    }

    const skillsDir = join(workspace, "skills");
    mkdirSync(skillsDir, { recursive: true });
  }

  private getBridgeDir(): string {
    const userBridge = join(getDataDir(), "bridge");
    if (existsSync(join(userBridge, "dist", "index.js"))) {
      return userBridge;
    }

    if (!which("npm")) {
      console.error("npm not found. Please install Node.js >= 18.");
      process.exit(1);
    }

    const cliDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
    const pkgRoot = resolve(cliDir, "..", "..");
    const pkgBridge = join(pkgRoot, "bridge");
    const srcBridge = join(pkgRoot, "..", "..", "bridge");

    let source: string | null = null;
    if (existsSync(join(pkgBridge, "package.json"))) {
      source = pkgBridge;
    } else if (existsSync(join(srcBridge, "package.json"))) {
      source = srcBridge;
    }

    if (!source) {
      console.error(`Bridge source not found. Try reinstalling ${APP_NAME}.`);
      process.exit(1);
    }

    console.log(`${this.logo} Setting up bridge...`);
    mkdirSync(resolve(userBridge, ".."), { recursive: true });
    if (existsSync(userBridge)) {
      rmSync(userBridge, { recursive: true, force: true });
    }
    cpSync(source, userBridge, {
      recursive: true,
      filter: (src) => !src.includes("node_modules") && !src.includes("dist")
    });

    const install = spawnSync("npm", ["install"], { cwd: userBridge, stdio: "pipe" });
    if (install.status !== 0) {
      console.error(`Bridge install failed: ${install.status ?? 1}`);
      if (install.stderr) {
        console.error(String(install.stderr).slice(0, 500));
      }
      process.exit(1);
    }

    const build = spawnSync("npm", ["run", "build"], { cwd: userBridge, stdio: "pipe" });
    if (build.status !== 0) {
      console.error(`Bridge build failed: ${build.status ?? 1}`);
      if (build.stderr) {
        console.error(String(build.stderr).slice(0, 500));
      }
      process.exit(1);
    }

    console.log("✓ Bridge ready\n");
    return userBridge;
  }
}

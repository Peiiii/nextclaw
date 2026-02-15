#!/usr/bin/env node
import { Command } from "commander";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  rmSync,
  openSync,
  closeSync
} from "node:fs";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import chokidar from "chokidar";
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
  ChannelManager,
  SessionManager,
  CronService,
  HeartbeatService,
  PROVIDERS,
  APP_NAME,
  APP_TAGLINE
} from "nextclaw-core";
import { startUiServer } from "nextclaw-server";

const LOGO = "🤖";
const EXIT_COMMANDS = new Set(["exit", "quit", "/exit", "/quit", ":q"]);
const VERSION = getPackageVersion();

const program = new Command();
program
  .name(APP_NAME)
  .description(`${LOGO} ${APP_NAME} - ${APP_TAGLINE}`)
  .version(VERSION, "-v, --version", "show version");

program
  .command("onboard")
  .description(`Initialize ${APP_NAME} configuration and workspace`)
  .action(() => {
    const configPath = getConfigPath();
    if (existsSync(configPath)) {
      console.log(`Config already exists at ${configPath}`);
    }
    const config = ConfigSchema.parse({});
    saveConfig(config);
    console.log(`✓ Created config at ${configPath}`);

    const workspace = getWorkspacePath();
    console.log(`✓ Created workspace at ${workspace}`);
    createWorkspaceTemplates(workspace);

    console.log(`\n${LOGO} ${APP_NAME} is ready!`);
    console.log("\nNext steps:");
    console.log(`  1. Add your API key to ${configPath}`);
    console.log(`  2. Chat: ${APP_NAME} agent -m "Hello!"`);
  });

program
  .command("gateway")
  .description(`Start the ${APP_NAME} gateway`)
  .option("-p, --port <port>", "Gateway port", "18790")
  .option("-v, --verbose", "Verbose output", false)
  .option("--ui", "Enable UI server", false)
  .option("--ui-host <host>", "UI host")
  .option("--ui-port <port>", "UI port")
  .option("--ui-open", "Open browser when UI starts", false)
  .action(async (opts) => {
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
    await startGateway({ uiOverrides });
  });

program
  .command("ui")
  .description(`Start the ${APP_NAME} UI with gateway`)
  .option("--host <host>", "UI host")
  .option("--port <port>", "UI port")
  .option("--no-open", "Disable opening browser")
  .action(async (opts) => {
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
    await startGateway({ uiOverrides, allowMissingProvider: true });
  });

program
  .command("start")
  .description(`Start the ${APP_NAME} gateway + UI in the background`)
  .option("--ui-host <host>", "UI host")
  .option("--ui-port <port>", "UI port")
  .option("--frontend", "Start UI frontend dev server")
  .option("--frontend-port <port>", "UI frontend dev server port")
  .option("--open", "Open browser after start", false)
  .action(async (opts) => {
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
      await runForeground({
        uiOverrides,
        frontend: shouldStartFrontend,
        frontendPort: devFrontendPort,
        open: Boolean(opts.open)
      });
      return;
    }

    await startService({
      uiOverrides,
      frontend: Boolean(opts.frontend),
      frontendPort: Number(opts.frontendPort),
      open: Boolean(opts.open)
    });
  });

program
  .command("serve")
  .description(`Run the ${APP_NAME} gateway + UI in the foreground`)
  .option("--ui-host <host>", "UI host")
  .option("--ui-port <port>", "UI port")
  .option("--frontend", "Start UI frontend dev server")
  .option("--frontend-port <port>", "UI frontend dev server port")
  .option("--open", "Open browser after start", false)
  .action(async (opts) => {
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
    await runForeground({
      uiOverrides,
      frontend: shouldStartFrontend,
      frontendPort,
      open: Boolean(opts.open)
    });
  });

program
  .command("stop")
  .description(`Stop the ${APP_NAME} background service`)
  .action(async () => {
    await stopService();
  });

program
  .command("agent")
  .description("Interact with the agent directly")
  .option("-m, --message <message>", "Message to send to the agent")
  .option("-s, --session <session>", "Session ID", "cli:default")
  .option("--no-markdown", "Disable Markdown rendering")
  .action(async (opts) => {
    const config = loadConfig();
    const bus = new MessageBus();
    const provider = makeProvider(config);
    const agentLoop = new AgentLoop({
      bus,
      provider,
      workspace: getWorkspacePath(config.agents.defaults.workspace),
      braveApiKey: config.tools.web.search.apiKey || undefined,
      execConfig: config.tools.exec,
      restrictToWorkspace: config.tools.restrictToWorkspace
    });

    if (opts.message) {
      const response = await agentLoop.processDirect({
        content: opts.message,
        sessionKey: opts.session,
        channel: "cli",
        chatId: "direct"
      });
      printAgentResponse(response);
      return;
    }

    console.log(`${LOGO} Interactive mode (type exit or Ctrl+C to quit)\n`);
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
      const response = await agentLoop.processDirect({ content: trimmed, sessionKey: opts.session });
      printAgentResponse(response);
    }
  });

const channels = program.command("channels").description("Manage channels");

channels
  .command("status")
  .description("Show channel status")
  .action(() => {
    const config = loadConfig();
    console.log("Channel Status");
    console.log(`WhatsApp: ${config.channels.whatsapp.enabled ? "✓" : "✗"}`);
    console.log(`Discord: ${config.channels.discord.enabled ? "✓" : "✗"}`);
    console.log(`Feishu: ${config.channels.feishu.enabled ? "✓" : "✗"}`);
    console.log(`Mochat: ${config.channels.mochat.enabled ? "✓" : "✗"}`);
    console.log(`Telegram: ${config.channels.telegram.enabled ? "✓" : "✗"}`);
    console.log(`Slack: ${config.channels.slack.enabled ? "✓" : "✗"}`);
    console.log(`QQ: ${config.channels.qq.enabled ? "✓" : "✗"}`);
  });

channels
  .command("login")
  .description("Link device via QR code")
  .action(() => {
    const bridgeDir = getBridgeDir();
    console.log(`${LOGO} Starting bridge...`);
    console.log("Scan the QR code to connect.\n");
    const result = spawnSync("npm", ["start"], { cwd: bridgeDir, stdio: "inherit" });
    if (result.status !== 0) {
      console.error(`Bridge failed: ${result.status ?? 1}`);
    }
  });

const cron = program.command("cron").description("Manage scheduled tasks");

cron
  .command("list")
  .option("-a, --all", "Include disabled jobs")
  .action((opts) => {
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
  });

cron
  .command("add")
  .requiredOption("-n, --name <name>", "Job name")
  .requiredOption("-m, --message <message>", "Message for agent")
  .option("-e, --every <seconds>", "Run every N seconds")
  .option("-c, --cron <expr>", "Cron expression")
  .option("--at <iso>", "Run once at time (ISO format)")
  .option("-d, --deliver", "Deliver response to channel")
  .option("--to <recipient>", "Recipient for delivery")
  .option("--channel <channel>", "Channel for delivery")
  .action((opts) => {
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
  });

cron
  .command("remove <jobId>")
  .action((jobId) => {
    const storePath = join(getDataDir(), "cron", "jobs.json");
    const service = new CronService(storePath);
    if (service.removeJob(jobId)) {
      console.log(`✓ Removed job ${jobId}`);
    } else {
      console.log(`Job ${jobId} not found`);
    }
  });

cron
  .command("enable <jobId>")
  .option("--disable", "Disable instead of enable")
  .action((jobId, opts) => {
    const storePath = join(getDataDir(), "cron", "jobs.json");
    const service = new CronService(storePath);
    const job = service.enableJob(jobId, !opts.disable);
    if (job) {
      console.log(`✓ Job '${job.name}' ${opts.disable ? "disabled" : "enabled"}`);
    } else {
      console.log(`Job ${jobId} not found`);
    }
  });

cron
  .command("run <jobId>")
  .option("-f, --force", "Run even if disabled")
  .action(async (jobId, opts) => {
    const storePath = join(getDataDir(), "cron", "jobs.json");
    const service = new CronService(storePath);
    const ok = await service.runJob(jobId, Boolean(opts.force));
    console.log(ok ? "✓ Job executed" : `Failed to run job ${jobId}`);
  });

program
  .command("status")
  .description(`Show ${APP_NAME} status`)
  .action(() => {
    const configPath = getConfigPath();
    const config = loadConfig();
    const workspace = getWorkspacePath(config.agents.defaults.workspace);
    console.log(`${LOGO} ${APP_NAME} Status\n`);
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
  });

program.parseAsync(process.argv);

async function startGateway(
  options: { uiOverrides?: Partial<Config["ui"]>; allowMissingProvider?: boolean; uiStaticDir?: string | null } = {}
): Promise<void> {
  const config = loadConfig();
  const bus = new MessageBus();
  const provider =
    options.allowMissingProvider === true
      ? makeProvider(config, { allowMissing: true })
      : makeProvider(config);
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
    provider,
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
    async (prompt) => agent.processDirect({ content: prompt, sessionKey: "heartbeat" }),
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

function resolveUiConfig(config: Config, overrides?: Partial<Config["ui"]>): Config["ui"] {
  const base = config.ui ?? { enabled: false, host: "127.0.0.1", port: 18791, open: false };
  return { ...base, ...(overrides ?? {}) };
}

function resolveUiApiBase(host: string, port: number): string {
  const normalizedHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  return `http://${normalizedHost}:${port}`;
}

function isDevRuntime(): boolean {
  return import.meta.url.includes("/src/cli/") || process.env.NEXTCLAW_DEV === "1";
}

function normalizeHostForPortCheck(host: string): string {
  return host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
}

async function findAvailablePort(port: number, host: string, attempts = 20): Promise<number> {
  const basePort = Number.isFinite(port) ? port : 0;
  let candidate = basePort;
  for (let i = 0; i < attempts; i += 1) {
    const ok = await isPortAvailable(candidate, host);
    if (ok) {
      return candidate;
    }
    candidate += 1;
  }
  return basePort;
}

async function isPortAvailable(port: number, host: string): Promise<boolean> {
  const checkHost = normalizeHostForPortCheck(host);
  const hostsToCheck: string[] = [checkHost];
  if (checkHost === "127.0.0.1") {
    hostsToCheck.push("::1");
  } else if (checkHost === "::1") {
    hostsToCheck.push("127.0.0.1");
  }

  for (const hostToCheck of hostsToCheck) {
    const ok = await canBindPort(port, hostToCheck);
    if (!ok) {
      return false;
    }
  }
  return true;
}

async function canBindPort(port: number, host: string): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ port, host }, () => {
      server.close(() => resolve(true));
    });
  });
}

type ServiceState = {
  pid: number;
  startedAt: string;
  uiUrl: string;
  apiUrl: string;
  logPath: string;
};

async function runForeground(options: {
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
  await startGateway({
    uiOverrides: options.uiOverrides,
    allowMissingProvider: true,
    uiStaticDir
  });
}

async function startService(options: {
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

async function stopService(): Promise<void> {
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

function buildServeArgs(options: {
  uiHost: string;
  uiPort: number;
  frontend: boolean;
  frontendPort: number;
}): string[] {
  const cliPath = fileURLToPath(import.meta.url);
  const args = [cliPath, "serve", "--ui-host", options.uiHost, "--ui-port", String(options.uiPort)];
  if (options.frontend) {
    args.push("--frontend");
  }
  if (Number.isFinite(options.frontendPort)) {
    args.push("--frontend-port", String(options.frontendPort));
  }
  return args;
}

function readServiceState(): ServiceState | null {
  const path = resolveServiceStatePath();
  if (!existsSync(path)) {
    return null;
  }
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as ServiceState;
  } catch {
    return null;
  }
}

function writeServiceState(state: ServiceState): void {
  const path = resolveServiceStatePath();
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}

function clearServiceState(): void {
  const path = resolveServiceStatePath();
  if (existsSync(path)) {
    rmSync(path, { force: true });
  }
}

function resolveServiceStatePath(): string {
  return resolve(getDataDir(), "run", "service.json");
}

function resolveServiceLogPath(): string {
  return resolve(getDataDir(), "logs", "service.log");
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isProcessRunning(pid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return !isProcessRunning(pid);
}

function resolveUiStaticDir(): string | null {
  const candidates: string[] = [];
  const envDir = process.env.NEXTCLAW_UI_STATIC_DIR;
  if (envDir) {
    candidates.push(envDir);
  }

  const cliDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
  const pkgRoot = resolve(cliDir, "..", "..");
  candidates.push(join(pkgRoot, "ui-dist"));
  candidates.push(join(pkgRoot, "ui"));
  candidates.push(join(pkgRoot, "..", "ui-dist"));
  candidates.push(join(pkgRoot, "..", "ui"));

  const cwd = process.cwd();
  candidates.push(join(cwd, "packages", "nextclaw-ui", "dist"));
  candidates.push(join(cwd, "nextclaw-ui", "dist"));
  candidates.push(join(pkgRoot, "..", "nextclaw-ui", "dist"));
  candidates.push(join(pkgRoot, "..", "..", "packages", "nextclaw-ui", "dist"));
  candidates.push(join(pkgRoot, "..", "..", "nextclaw-ui", "dist"));

  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) {
      return dir;
    }
  }
  return null;
}

function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;
  let args: string[];
  if (platform === "darwin") {
    command = "open";
    args = [url];
  } else if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.unref();
}

function makeProvider(config: ReturnType<typeof loadConfig>, options: { allowMissing: true }): LiteLLMProvider | null;
function makeProvider(config: ReturnType<typeof loadConfig>, options?: { allowMissing?: false }): LiteLLMProvider;
function makeProvider(config: ReturnType<typeof loadConfig>, options?: { allowMissing?: boolean }) {
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

function createWorkspaceTemplates(workspace: string): void {
  const templates: Record<string, string> = {
    "AGENTS.md": "# Agent Instructions\n\nYou are a helpful AI assistant. Be concise, accurate, and friendly.\n\n## Guidelines\n\n- Always explain what you're doing before taking actions\n- Ask for clarification when the request is ambiguous\n- Use tools to help accomplish tasks\n- Remember important information in your memory files\n",
    "SOUL.md": `# Soul\n\nI am ${APP_NAME}, a lightweight AI assistant.\n\n## Personality\n\n- Helpful and friendly\n- Concise and to the point\n- Curious and eager to learn\n\n## Values\n\n- Accuracy over speed\n- User privacy and safety\n- Transparency in actions\n`,
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

function printAgentResponse(response: string): void {
  console.log("\n" + response + "\n");
}

async function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  rl.setPrompt(question);
  rl.prompt();
  return new Promise((resolve) => {
    rl.once("line", (line) => resolve(line));
  });
}

function getBridgeDir(): string {
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

  console.log(`${LOGO} Setting up bridge...`);
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

function getPackageVersion(): string {
  try {
    const cliDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
    const pkgPath = resolve(cliDir, "..", "..", "package.json");
    const raw = readFileSync(pkgPath, "utf-8");
    const parsed = JSON.parse(raw) as { version?: string };
    return typeof parsed.version === "string" ? parsed.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function which(binary: string): boolean {
  const paths = (process.env.PATH ?? "").split(":");
  for (const dir of paths) {
    const full = join(dir, binary);
    if (existsSync(full)) {
      return true;
    }
  }
  return false;
}

function startUiFrontend(options: { apiBase: string; port: number; dir?: string }): { url: string; dir: string } | null {
  const uiDir = options.dir ?? resolveUiFrontendDir();
  if (!uiDir) {
    return null;
  }
  const runner = resolveUiFrontendRunner();
  if (!runner) {
    console.log("Warning: pnpm/npm not found. Skipping UI frontend.");
    return null;
  }

  const args = [...runner.args];
  if (options.port) {
    if (runner.useArgSeparator) {
      args.push("--");
    }
    args.push("--port", String(options.port));
  }
  const env = { ...process.env, VITE_API_BASE: options.apiBase };
  const child = spawn(runner.cmd, args, { cwd: uiDir, stdio: "inherit", env });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.log(`UI frontend exited with code ${code}`);
    }
  });

  const url = `http://127.0.0.1:${options.port}`;
  console.log(`✓ UI frontend: ${url}`);
  return { url, dir: uiDir };
}

function resolveUiFrontendRunner(): { cmd: string; args: string[]; useArgSeparator: boolean } | null {
  if (which("pnpm")) {
    return { cmd: "pnpm", args: ["dev"], useArgSeparator: false };
  }
  if (which("npm")) {
    return { cmd: "npm", args: ["run", "dev"], useArgSeparator: true };
  }
  return null;
}

function resolveUiFrontendDir(): string | null {
  const candidates: string[] = [];
  const envDir = process.env.NEXTCLAW_UI_DIR;
  if (envDir) {
    candidates.push(envDir);
  }

  const cwd = process.cwd();
  candidates.push(join(cwd, "packages", "nextclaw-ui"));
  candidates.push(join(cwd, "nextclaw-ui"));

  const cliDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
  const pkgRoot = resolve(cliDir, "..", "..");
  candidates.push(join(pkgRoot, "..", "nextclaw-ui"));
  candidates.push(join(pkgRoot, "..", "..", "packages", "nextclaw-ui"));
  candidates.push(join(pkgRoot, "..", "..", "nextclaw-ui"));

  for (const dir of candidates) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
  }
  return null;
}

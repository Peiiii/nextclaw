#!/usr/bin/env node
import { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { loadConfig, saveConfig, getConfigPath, getDataDir } from "../config/loader.js";
import { ConfigSchema, getApiBase, getProvider, getProviderName, type Config } from "../config/schema.js";
import { getWorkspacePath } from "../utils/helpers.js";
import { MessageBus } from "../bus/queue.js";
import { AgentLoop } from "../agent/loop.js";
import { LiteLLMProvider } from "../providers/litellm_provider.js";
import { ChannelManager } from "../channels/manager.js";
import { SessionManager } from "../session/manager.js";
import { CronService } from "../cron/service.js";
import { HeartbeatService } from "../heartbeat/service.js";
import { PROVIDERS } from "../providers/registry.js";
import { startUiServer } from "../ui/server.js";
import { APP_NAME, APP_TAGLINE } from "../config/brand.js";

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
  .description(`Start the ${APP_NAME} gateway + UI (backend + frontend)`)
  .option("--ui-host <host>", "UI host")
  .option("--ui-port <port>", "UI port")
  .option("--frontend-port <port>", "UI frontend dev server port")
  .option("--no-frontend", "Disable UI frontend dev server")
  .option("--no-open", "Disable opening browser")
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

    const config = loadConfig();
    const uiConfig = resolveUiConfig(config, uiOverrides);
    const staticDir = resolveUiStaticDir();
    const frontendPort = Number.isFinite(Number(opts.frontendPort)) ? Number(opts.frontendPort) : 5173;
    const shouldStartFrontend = opts.frontend !== false;
    const frontendDir = shouldStartFrontend ? resolveUiFrontendDir() : null;

    let frontendUrl: string | null = null;
    if (shouldStartFrontend && frontendDir) {
      const frontend = startUiFrontend({
        apiBase: resolveUiApiBase(uiConfig.host, uiConfig.port),
        port: frontendPort,
        dir: frontendDir
      });
      frontendUrl = frontend?.url ?? null;
    } else if (shouldStartFrontend && !frontendDir && !staticDir) {
      console.log("Warning: UI frontend not found. Start it separately.");
    }
    if (!frontendUrl && staticDir) {
      frontendUrl = resolveUiApiBase(uiConfig.host, uiConfig.port);
    }

    if (opts.open && frontendUrl) {
      openBrowser(frontendUrl);
    } else if (opts.open && !frontendUrl) {
      console.log("Warning: UI frontend not started. Browser not opened.");
    }

    await startGateway({ uiOverrides, allowMissingProvider: true, uiStaticDir: staticDir ?? undefined });
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
  options: { uiOverrides?: Partial<Config["ui"]>; allowMissingProvider?: boolean; uiStaticDir?: string } = {}
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
  const uiStaticDir = options.uiStaticDir ?? resolveUiStaticDir();
  if (!provider) {
    if (uiConfig.enabled) {
      const uiServer = startUiServer({
        host: uiConfig.host,
        port: uiConfig.port,
        configPath: getConfigPath(),
        staticDir: uiStaticDir ?? undefined,
        onReload: async () => {
          return;
        }
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

  const channels = new ChannelManager(config, bus, sessionManager);
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
      staticDir: uiStaticDir ?? undefined,
      onReload: async () => {
        return;
      }
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
    providerName: getProviderName(config)
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
    args.push("--", "--port", String(options.port));
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

function resolveUiFrontendRunner(): { cmd: string; args: string[] } | null {
  if (which("pnpm")) {
    return { cmd: "pnpm", args: ["dev"] };
  }
  if (which("npm")) {
    return { cmd: "npm", args: ["run", "dev"] };
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

#!/usr/bin/env node
import { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { loadConfig, saveConfig, getConfigPath, getDataDir } from "../config/loader.js";
import { ConfigSchema, getApiBase, getProvider, getProviderName } from "../config/schema.js";
import { getWorkspacePath } from "../utils/helpers.js";
import { MessageBus } from "../bus/queue.js";
import { AgentLoop } from "../agent/loop.js";
import { LiteLLMProvider } from "../providers/litellm_provider.js";
import { ChannelManager } from "../channels/manager.js";
import { SessionManager } from "../session/manager.js";
import { CronService } from "../cron/service.js";
import { HeartbeatService } from "../heartbeat/service.js";
import { PROVIDERS } from "../providers/registry.js";

const LOGO = "🤖";
const EXIT_COMMANDS = new Set(["exit", "quit", "/exit", "/quit", ":q"]);

const program = new Command();
program
  .name("nextbot")
  .description(`${LOGO} nextbot - Personal AI Assistant`)
  .version("0.0.1", "-v, --version", "show version");

program
  .command("onboard")
  .description("Initialize nextbot configuration and workspace")
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

    console.log(`\n${LOGO} nextbot is ready!`);
    console.log("\nNext steps:");
    console.log("  1. Add your API key to ~/.nextbot/config.json");
    console.log('  2. Chat: nextbot agent -m "Hello!"');
  });

program
  .command("gateway")
  .description("Start the nextbot gateway")
  .option("-p, --port <port>", "Gateway port", "18790")
  .option("-v, --verbose", "Verbose output", false)
  .action(async (_opts) => {
    const config = loadConfig();
    const bus = new MessageBus();
    const provider = makeProvider(config);
    const sessionManager = new SessionManager(getWorkspacePath(config.agents.defaults.workspace));

    const cronStorePath = join(getDataDir(), "cron", "jobs.json");
    const cron = new CronService(cronStorePath);

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

    const cronStatus = cron.status();
    if (cronStatus.jobs > 0) {
      console.log(`✓ Cron: ${cronStatus.jobs} scheduled jobs`);
    }
    console.log("✓ Heartbeat: every 30m");

    await cron.start();
    await heartbeat.start();

    await Promise.allSettled([agent.run(), channels.startAll()]);
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
  .description("Show nextbot status")
  .action(() => {
    const configPath = getConfigPath();
    const config = loadConfig();
    const workspace = getWorkspacePath(config.agents.defaults.workspace);
    console.log(`${LOGO} nextbot Status\n`);
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

function makeProvider(config: ReturnType<typeof loadConfig>) {
  const provider = getProvider(config);
  const model = config.agents.defaults.model;
  if (!provider?.apiKey && !model.startsWith("bedrock/")) {
    console.error("Error: No API key configured.");
    console.error("Set one in ~/.nextbot/config.json under providers section");
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
    "SOUL.md": "# Soul\n\nI am nextbot, a lightweight AI assistant.\n\n## Personality\n\n- Helpful and friendly\n- Concise and to the point\n- Curious and eager to learn\n\n## Values\n\n- Accuracy over speed\n- User privacy and safety\n- Transparency in actions\n",
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
    console.error("Bridge source not found. Try reinstalling nextbot.");
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

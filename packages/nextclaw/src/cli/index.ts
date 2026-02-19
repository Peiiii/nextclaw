#!/usr/bin/env node
import { Command } from "commander";
import { APP_NAME, APP_TAGLINE } from "@nextclaw/core";
import { CliRuntime, LOGO } from "./runtime.js";
import { getPackageVersion } from "./utils.js";

const program = new Command();
const runtime = new CliRuntime({ logo: LOGO });

program
  .name(APP_NAME)
  .description(`${LOGO} ${APP_NAME} - ${APP_TAGLINE}`)
  .version(getPackageVersion(), "-v, --version", "show version");

program
  .command("onboard")
  .description(`Initialize ${APP_NAME} configuration and workspace`)
  .action(async () => runtime.onboard());

program
  .command("init")
  .description(`Initialize ${APP_NAME} configuration and workspace`)
  .option("-f, --force", "Overwrite existing template files")
  .action(async (opts) => runtime.init({ force: Boolean(opts.force) }));

program
  .command("gateway")
  .description(`Start the ${APP_NAME} gateway`)
  .option("-p, --port <port>", "Gateway port", "18790")
  .option("-v, --verbose", "Verbose output", false)
  .option("--ui", "Enable UI server", false)
  .option("--ui-port <port>", "UI port")
  .option("--ui-open", "Open browser when UI starts", false)
  .action(async (opts) => runtime.gateway(opts));

program
  .command("ui")
  .description(`Start the ${APP_NAME} UI with gateway`)
  .option("--port <port>", "UI port")
  .option("--no-open", "Disable opening browser")
  .action(async (opts) => runtime.ui(opts));

program
  .command("start")
  .description(`Start the ${APP_NAME} gateway + UI in the background`)
  .option("--ui-port <port>", "UI port")
  .option("--open", "Open browser after start", false)
  .action(async (opts) => runtime.start(opts));

program
  .command("restart")
  .description(`Restart the ${APP_NAME} background service`)
  .option("--ui-port <port>", "UI port")
  .option("--open", "Open browser after restart", false)
  .action(async (opts) => runtime.restart(opts));

program
  .command("serve")
  .description(`Run the ${APP_NAME} gateway + UI in the foreground`)
  .option("--ui-port <port>", "UI port")
  .option("--open", "Open browser after start", false)
  .action(async (opts) => runtime.serve(opts));

program
  .command("stop")
  .description(`Stop the ${APP_NAME} background service`)
  .action(async () => runtime.stop());

program
  .command("agent")
  .description("Interact with the agent directly")
  .option("-m, --message <message>", "Message to send to the agent")
  .option("-s, --session <session>", "Session ID", "cli:default")
  .option("--model <model>", "Session model override for this run")
  .option("--no-markdown", "Disable Markdown rendering")
  .action(async (opts) => runtime.agent(opts));

program
  .command("update")
  .description(`Update ${APP_NAME}`)
  .option("--timeout <ms>", "Update command timeout in milliseconds")
  .action(async (opts) => runtime.update(opts));

const registerClawHubInstall = (cmd: Command) => {
  cmd
    .command("install <slug>")
    .description("Install a skill from ClawHub")
    .option("--version <version>", "Skill version (default: latest)")
    .option("--registry <url>", "ClawHub registry base URL")
    .option("--workdir <dir>", "Workspace directory to install into")
    .option("--dir <dir>", "Skills directory name (default: skills)")
    .option("-f, --force", "Overwrite existing skill files", false)
    .action(async (slug, opts) => runtime.skillsInstall({ slug, ...opts }));
};

const skills = program.command("skills").description("Manage skills");
registerClawHubInstall(skills);

const clawhub = program.command("clawhub").description("Install skills from ClawHub");
registerClawHubInstall(clawhub);

const plugins = program.command("plugins").description("Manage OpenClaw-compatible plugins");

plugins
  .command("list")
  .description("List discovered plugins")
  .option("--json", "Print JSON")
  .option("--enabled", "Only show enabled plugins", false)
  .option("--verbose", "Show detailed entries", false)
  .action((opts) => runtime.pluginsList(opts));

plugins
  .command("info <id>")
  .description("Show plugin details")
  .option("--json", "Print JSON")
  .action((id, opts) => runtime.pluginsInfo(id, opts));

plugins
  .command("enable <id>")
  .description("Enable a plugin in config")
  .action((id) => runtime.pluginsEnable(id));

plugins
  .command("disable <id>")
  .description("Disable a plugin in config")
  .action((id) => runtime.pluginsDisable(id));

plugins
  .command("uninstall <id>")
  .description("Uninstall a plugin")
  .option("--keep-files", "Keep installed files on disk", false)
  .option("--keep-config", "Deprecated alias for --keep-files", false)
  .option("--force", "Skip confirmation prompt", false)
  .option("--dry-run", "Show what would be removed without making changes", false)
  .action(async (id, opts) => runtime.pluginsUninstall(id, opts));

plugins
  .command("install <path-or-spec>")
  .description("Install a plugin (path, archive, or npm spec)")
  .option("-l, --link", "Link a local path instead of copying", false)
  .action(async (pathOrSpec, opts) => runtime.pluginsInstall(pathOrSpec, opts));

plugins
  .command("doctor")
  .description("Report plugin load issues")
  .action(() => runtime.pluginsDoctor());

const config = program.command("config").description("Manage config values");

config
  .command("get <path>")
  .description("Get a config value by dot path")
  .option("--json", "Output JSON", false)
  .action((path, opts) => runtime.configGet(path, opts));

config
  .command("set <path> <value>")
  .description("Set a config value by dot path")
  .option("--json", "Parse value as JSON", false)
  .action((path, value, opts) => runtime.configSet(path, value, opts));

config
  .command("unset <path>")
  .description("Remove a config value by dot path")
  .action((path) => runtime.configUnset(path));

const channels = program.command("channels").description("Manage channels");

channels
  .command("add")
  .description("Configure a plugin channel (OpenClaw-compatible setup)")
  .requiredOption("--channel <id>", "Plugin channel id")
  .option("--code <code>", "Pairing code")
  .option("--token <token>", "Connector token")
  .option("--name <name>", "Display name")
  .option("--url <url>", "API base URL")
  .option("--http-url <url>", "Alias for --url")
  .action((opts) => runtime.channelsAdd(opts));

channels
  .command("status")
  .description("Show channel status")
  .action(() => runtime.channelsStatus());

channels
  .command("login")
  .description("Link device via QR code")
  .action(() => runtime.channelsLogin());

const cron = program.command("cron").description("Manage scheduled tasks");

cron
  .command("list")
  .option("-a, --all", "Include disabled jobs")
  .action((opts) => runtime.cronList(opts));

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
  .action((opts) => runtime.cronAdd(opts));

cron
  .command("remove <jobId>")
  .action((jobId) => runtime.cronRemove(jobId));

cron
  .command("enable <jobId>")
  .option("--disable", "Disable instead of enable")
  .action((jobId, opts) => runtime.cronEnable(jobId, opts));

cron
  .command("run <jobId>")
  .option("-f, --force", "Run even if disabled")
  .action(async (jobId, opts) => runtime.cronRun(jobId, opts));

program
  .command("status")
  .description(`Show ${APP_NAME} status`)
  .option("--json", "Output JSON", false)
  .option("--verbose", "Show extra diagnostics", false)
  .option("--fix", "Fix stale service state when safe", false)
  .action(async (opts) => runtime.status(opts));

program
  .command("doctor")
  .description(`Run ${APP_NAME} diagnostics`)
  .option("--json", "Output JSON", false)
  .option("--verbose", "Show extra diagnostics", false)
  .option("--fix", "Fix stale service state when safe", false)
  .action(async (opts) => runtime.doctor(opts));

program.parseAsync(process.argv);

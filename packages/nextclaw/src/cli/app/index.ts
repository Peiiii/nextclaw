#!/usr/bin/env node
import { Command } from "commander";
import { APP_NAME, APP_TAGLINE } from "@nextclaw/core";
import { registerRemoteCommands } from "@nextclaw/remote";
import { LlmUsageCommandService } from "../commands/usage/index.js";
import { CliRuntime, LOGO } from "./runtime.js";
import { registerSkillsCommands } from "../commands/skills/index.js";
import { registerAgentsCommands } from "./register-agents-commands.js";
import { registerLearningLoopCommands } from "../commands/learning-loop/index.js";
import { registerServiceCommands } from "./service-command-registration.service.js";
import { logStartupTrace, measureStartupSync } from "../shared/utils/startup-trace.js";
import { getPackageVersion } from "../shared/utils/cli.utils.js";
import type { ServiceCommands } from "../commands/service/index.js";

logStartupTrace("cli.index.module_loaded");

const program = new Command();
const runtime = measureStartupSync("cli.runtime.construct", () => new CliRuntime({ logo: LOGO }));
const llmUsageCommands = new LlmUsageCommandService();
const withRepeatableTag = (value: string, previous: string[] = []) => [...previous, value];
const getServiceCommands = (): ServiceCommands => {
  const serviceCommands = (runtime as unknown as { serviceCommands?: ServiceCommands }).serviceCommands;
  if (!serviceCommands) {
    throw new Error("Service commands are unavailable.");
  }
  return serviceCommands;
};

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
  .command("login")
  .description("Sign in to NextClaw Platform and save the platform token locally (browser flow by default)")
  .option("--api-base <url>", "Platform API base (supports /v1 suffix)")
  .option("--email <email>", "Login email for direct password sign-in")
  .option("--password <password>", "Login password for direct password sign-in")
  .option("--no-open", "Do not open the browser automatically")
  .action(async (opts) => runtime.login(opts));

const account = program.command("account").description("Inspect and manage your NextClaw account");

account
  .command("status")
  .description("Show account status and personal marketplace publish readiness")
  .option("--api-base <url>", "Platform API base (supports /v1 suffix)")
  .option("--json", "Output JSON", false)
  .action(async (opts) => {
    await runtime.init({ source: "account status", auto: true });
    await runtime.platformAuthCommands.accountStatus(opts);
  });

account
  .command("set-username <username>")
  .description("Set your NextClaw username for personal marketplace publishing")
  .option("--api-base <url>", "Platform API base (supports /v1 suffix)")
  .option("--json", "Output JSON", false)
  .action(async (username, opts) => {
    await runtime.init({ source: "account set-username", auto: true });
    await runtime.platformAuthCommands.accountSetUsername({
      apiBase: opts.apiBase,
      json: opts.json,
      username
    });
  });

registerRemoteCommands(program, runtime.remote);

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
  .option("--start-timeout <ms>", "Maximum wait time for startup readiness in milliseconds")
  .option("--open", "Open browser after start", false)
  .action(async (opts) => runtime.start(opts));

program
  .command("restart")
  .description(`Restart the ${APP_NAME} background service`)
  .option("--ui-port <port>", "UI port")
  .option("--start-timeout <ms>", "Maximum wait time for startup readiness in milliseconds")
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

registerServiceCommands({
  program,
  getServiceCommands,
});

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

registerSkillsCommands(program, runtime.skillsCommands);

registerAgentsCommands(program, runtime);

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

registerLearningLoopCommands(program, runtime);

const mcp = program.command("mcp").description("Manage MCP servers");

mcp
  .command("list")
  .description("List configured MCP servers")
  .option("--json", "Output JSON", false)
  .action((opts) => runtime.mcpList(opts));

mcp
  .command("add <name> [command...]")
  .description("Add an MCP server (stdio by default, or use --transport http|sse)")
  .allowUnknownOption(true)
  .option("--transport <type>", "Transport type: stdio|http|sse", "stdio")
  .option("--url <url>", "HTTP/SSE endpoint URL")
  .option("--header <key=value>", "Transport header (repeatable)", withRepeatableTag, [])
  .option("--env <key=value>", "stdio env var (repeatable)", withRepeatableTag, [])
  .option("--cwd <dir>", "stdio working directory")
  .option("--timeout-ms <ms>", "HTTP/SSE timeout in milliseconds")
  .option("--stderr <mode>", "stdio stderr handling: inherit|pipe|ignore", "pipe")
  .option("--disabled", "Create the server in disabled state", false)
  .option("--all-agents", "Expose this server to all agents", false)
  .option("--agent <id>", "Expose to an agent id (repeatable)", withRepeatableTag, [])
  .option("--insecure", "Disable TLS verification for HTTP/SSE", false)
  .action(async (name, command, opts) => runtime.mcpAdd(name, command ?? [], opts));

mcp
  .command("remove <name>")
  .description("Remove an MCP server")
  .action(async (name) => runtime.mcpRemove(name));

mcp
  .command("enable <name>")
  .description("Enable an MCP server")
  .action(async (name) => runtime.mcpEnable(name));

mcp
  .command("disable <name>")
  .description("Disable an MCP server")
  .action(async (name) => runtime.mcpDisable(name));

mcp
  .command("doctor [name]")
  .description("Check MCP server connectivity and tool discovery")
  .option("--json", "Output JSON", false)
  .action(async (name, opts) => runtime.mcpDoctor(name, opts));

const secrets = program.command("secrets").description("Manage secrets refs/providers");

secrets
  .command("audit")
  .description("Audit secret refs resolution status")
  .option("--json", "Output JSON", false)
  .option("--strict", "Exit non-zero when unresolved refs exist", false)
  .action((opts) => runtime.secretsAudit(opts));

secrets
  .command("configure")
  .description("Configure a secret provider alias")
  .requiredOption("--provider <alias>", "Provider alias")
  .option("--source <source>", "Provider source (env|file|exec)")
  .option("--prefix <prefix>", "Env key prefix (env source)")
  .option("--path <path>", "Secret JSON file path (file source)")
  .option("--command <command>", "Command for exec source")
  .option(
    "--arg <value>",
    "Exec argument (repeatable)",
    (value: string, previous: string[] = []) => [...previous, value],
    []
  )
  .option("--cwd <dir>", "Exec working directory")
  .option("--timeout-ms <ms>", "Exec timeout in milliseconds")
  .option("--set-default", "Set as default alias for this source", false)
  .option("--remove", "Remove provider alias", false)
  .option("--json", "Output JSON", false)
  .action((opts) => runtime.secretsConfigure(opts));

secrets
  .command("apply")
  .description("Apply secret refs/providers/defaults patch")
  .option("--file <path>", "Apply patch from JSON file")
  .option("--path <config-path>", "Single ref target config path")
  .option("--source <source>", "Single ref source (env|file|exec)")
  .option("--id <secret-id>", "Single ref secret id")
  .option("--provider <alias>", "Single ref provider alias")
  .option("--remove", "Remove single ref (--path required)", false)
  .option("--enable", "Enable secrets resolution", false)
  .option("--disable", "Disable secrets resolution", false)
  .option("--json", "Output JSON", false)
  .action((opts) => runtime.secretsApply(opts));

secrets
  .command("reload")
  .description("Trigger runtime secrets reload signal")
  .option("--json", "Output JSON", false)
  .action((opts) => runtime.secretsReload(opts));

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
  .option("--channel <id>", "Plugin channel id")
  .option("--account <id>", "Channel account id")
  .option("--url <url>", "Channel API base URL")
  .option("--http-url <url>", "Alias for --url")
  .option("-v, --verbose", "Verbose output", false)
  .action(async (opts) => runtime.channelsLogin(opts));

const cron = program.command("cron").description("Manage scheduled tasks");

cron
  .command("list")
  .option("--enabled-only", "Show only enabled jobs", false)
  .option("-a, --all", "Deprecated: list all jobs (default behavior)", false)
  .action(async (opts) => runtime.cronList({ enabledOnly: Boolean(opts.enabledOnly) }));

cron
  .command("add")
  .requiredOption("-n, --name <name>", "Job name")
  .requiredOption("-m, --message <message>", "Message for agent")
  .option("--agent <id>", "Target agent id")
  .option("-e, --every <seconds>", "Run every N seconds")
  .option("-c, --cron <expr>", "Cron expression")
  .option("--at <iso>", "Run once at time (ISO format)")
  .option("-d, --deliver", "Deliver response to channel")
  .option("--to <recipient>", "Recipient for delivery")
  .option("--channel <channel>", "Channel for delivery")
  .option("--account <id>", "Account id for channel delivery")
  .action(async (opts) => runtime.cronAdd(opts));

cron
  .command("remove <jobId>")
  .action(async (jobId) => runtime.cronRemove(jobId));

cron
  .command("enable <jobId>")
  .option("--disable", "Disable instead of enable")
  .action(async (jobId, opts) => runtime.cronEnable(jobId, opts));

cron
  .command("disable <jobId>")
  .action(async (jobId) => runtime.cronEnable(jobId, { disable: true }));

cron
  .command("run <jobId>")
  .option("-f, --force", "Run even if disabled")
  .action(async (jobId, opts) => runtime.cronRun(jobId, opts));

program.command("status").description(`Show ${APP_NAME} status`).option("--json", "Output JSON", false).option("--verbose", "Show extra diagnostics", false).option("--fix", "Fix stale service state when safe", false).action(async (opts) => runtime.status(opts));
program.command("doctor").description(`Run ${APP_NAME} diagnostics`).option("--json", "Output JSON", false).option("--verbose", "Show extra diagnostics", false).option("--fix", "Fix stale service state when safe", false).action(async (opts) => runtime.doctor(opts));
const logs = program.command("logs").description("Inspect local runtime logs");
logs.command("path").description("Show local log file paths").action(() => runtime.logsPath());
logs.command("tail").description("Show recent local log entries").option("--lines <n>", "Number of lines to show", "40").option("--crash", "Tail crash.log instead of service.log", false).action((opts) => runtime.logsTail(opts));
program.command("usage").description("Show observed LLM usage snapshots, history, and prompt cache stats").option("--history", "Show recent usage history", false).option("--stats", "Show aggregated usage stats from local history", false).option("--limit <n>", "Maximum number of history records to show", "10").option("--json", "Output JSON", false).action(async (opts) => llmUsageCommands.show(opts));

program.parseAsync(process.argv);

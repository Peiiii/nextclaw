#!/usr/bin/env node
import { Command } from "commander";
import { APP_NAME, APP_TAGLINE } from "nextclaw-core";
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
  .command("gateway")
  .description(`Start the ${APP_NAME} gateway`)
  .option("-p, --port <port>", "Gateway port", "18790")
  .option("-v, --verbose", "Verbose output", false)
  .option("--ui", "Enable UI server", false)
  .option("--ui-host <host>", "UI host")
  .option("--ui-port <port>", "UI port")
  .option("--ui-open", "Open browser when UI starts", false)
  .action(async (opts) => runtime.gateway(opts));

program
  .command("ui")
  .description(`Start the ${APP_NAME} UI with gateway`)
  .option("--host <host>", "UI host")
  .option("--port <port>", "UI port")
  .option("--no-open", "Disable opening browser")
  .action(async (opts) => runtime.ui(opts));

program
  .command("start")
  .description(`Start the ${APP_NAME} gateway + UI in the background`)
  .option("--ui-host <host>", "UI host")
  .option("--ui-port <port>", "UI port")
  .option("--frontend", "Start UI frontend dev server")
  .option("--frontend-port <port>", "UI frontend dev server port")
  .option("--open", "Open browser after start", false)
  .action(async (opts) => runtime.start(opts));

program
  .command("serve")
  .description(`Run the ${APP_NAME} gateway + UI in the foreground`)
  .option("--ui-host <host>", "UI host")
  .option("--ui-port <port>", "UI port")
  .option("--frontend", "Start UI frontend dev server")
  .option("--frontend-port <port>", "UI frontend dev server port")
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
  .option("--no-markdown", "Disable Markdown rendering")
  .action(async (opts) => runtime.agent(opts));

const channels = program.command("channels").description("Manage channels");

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
  .action(() => runtime.status());

program.parseAsync(process.argv);

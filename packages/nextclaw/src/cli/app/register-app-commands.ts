import type { Command } from "commander";
import { AppCallCommandController } from "./controllers/app-call-command.controller.js";
import { AppCheckCommandController } from "./controllers/app-check-command.controller.js";
import { AppDevCommandController } from "./controllers/app-dev-command.controller.js";
import { AppDataCommandController } from "./controllers/app-data-command.controller.js";
import { AppRestartCommandController } from "./controllers/app-restart-command.controller.js";
import { AppPublishCommandController } from "./controllers/app-publish-command.controller.js";
import { AppValidatePublishCommandController } from "./controllers/app-validate-publish-command.controller.js";

export function registerAppCommands(program: Command): void {
  const app = program.command("app").description("Develop, validate, and publish NextClaw apps");
  const appCheck = new AppCheckCommandController();
  const appDev = new AppDevCommandController();
  const appData = new AppDataCommandController();
  const appCall = new AppCallCommandController();
  const appRestart = new AppRestartCommandController();
  const appValidatePublish = new AppValidatePublishCommandController();
  const appPublish = new AppPublishCommandController();

  app
    .command("validate-publish <app-dir>")
    .description("Validate a NextClaw Mini App before Marketplace submission")
    .option("--meta <path>", "Use a custom marketplace metadata file")
    .option("--json", "Output JSON", false)
    .action(async (target, opts) => appValidatePublish.validate(target, opts));

  app
    .command("publish <app-dir>")
    .description("Submit a NextClaw Mini App to the App Marketplace")
    .option("--meta <path>", "Use a custom marketplace metadata file")
    .option("--allow-warnings", "Submit after reviewing validation warnings", false)
    .option("--json", "Output JSON", false)
    .action(async (target, opts) => appPublish.publish(target, opts));

  app
    .command("check <app-dir>")
    .description("Check a Panel App or Service App directory")
    .option("--json", "Output JSON", false)
    .action(async (target, opts) => appCheck.check(target, opts));

  app
    .command("dev <service-app-dir>")
    .description("Start a Service App through the real runtime and inspect its actions")
    .option("--json", "Output JSON", false)
    .option("--reset-data", "Reset the exact development instance before starting", false)
    .option("--confirm <app-id>", "Confirm the Service App id when resetting data")
    .action(async (target, opts) => appDev.dev(target, opts));

  const data = app.command("data").description("Inspect and manage NextClaw App data");

  data
    .command("list")
    .description("List active and retained App data through the running NextClaw host")
    .option("--json", "Output JSON", false)
    .action(async (opts) => appData.list(opts));

  data
    .command("delete <data-id>")
    .description("Permanently delete a retained App data instance")
    .requiredOption("--confirm <app-id>", "Confirm the exact App id")
    .option("--json", "Output JSON", false)
    .action(async (dataId, opts) => appData.deleteRetained(dataId, opts));

  app
    .command("call <service-app-dir> <action-name>")
    .description("Call a Service App action through the real runtime")
    .option("--input <json>", "JSON object input for the action")
    .option("--json", "Output JSON", false)
    .action(async (target, actionName, opts) => appCall.call(target, actionName, opts));

  app
    .command("restart <app-id>")
    .description("Restart a live Service App runtime in the running NextClaw UI")
    .option("--json", "Output JSON", false)
    .action(async (appId, opts) => appRestart.restart(appId, opts));
}

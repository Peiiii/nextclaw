import type { Command } from "commander";
import { AppCallCommandController } from "./controllers/app-call-command.controller.js";
import { AppCheckCommandController } from "./controllers/app-check-command.controller.js";
import { AppDevCommandController } from "./controllers/app-dev-command.controller.js";
import { AppRestartCommandController } from "./controllers/app-restart-command.controller.js";

export function registerAppCommands(program: Command): void {
  const app = program.command("app").description("Inspect and validate lightweight NextClaw apps");
  const appCheck = new AppCheckCommandController();
  const appDev = new AppDevCommandController();
  const appCall = new AppCallCommandController();
  const appRestart = new AppRestartCommandController();

  app
    .command("check <app-dir>")
    .description("Check a Panel App or Service App directory")
    .option("--json", "Output JSON", false)
    .action(async (target, opts) => appCheck.check(target, opts));

  app
    .command("dev <service-app-dir>")
    .description("Start a Service App through the real runtime and inspect its actions")
    .option("--json", "Output JSON", false)
    .action(async (target, opts) => appDev.dev(target, opts));

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

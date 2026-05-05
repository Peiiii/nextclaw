import type { Command } from "commander";
import type { CliRuntime } from "./runtime.js";

export function registerCompanionCommands(program: Command, runtime: CliRuntime): void {
  const companion = program
    .command("companion")
    .description("Manage the standalone NextClaw companion shell");

  companion
    .command("start")
    .description("Start the companion shell in the background")
    .option("--base-url <url>", "Explicit NextClaw UI base URL")
    .action(async (opts) => runtime.companionStart(opts));

  companion
    .command("enable")
    .description("Enable the companion feature and start it when a local runtime is available")
    .option("--base-url <url>", "Explicit NextClaw UI base URL")
    .action(async (opts) => runtime.companionEnable(opts));

  companion
    .command("disable")
    .description("Disable the companion feature and stop any running companion process")
    .action(async (opts) => runtime.companionDisable(opts));

  companion
    .command("status")
    .description("Show companion process status")
    .option("--json", "Output JSON", false)
    .action(async (opts) => runtime.companionStatus(opts));

  companion
    .command("stop")
    .description("Stop the companion process")
    .option("--force", "Force kill the companion process", false)
    .action(async (opts) => runtime.companionStop(opts));
}

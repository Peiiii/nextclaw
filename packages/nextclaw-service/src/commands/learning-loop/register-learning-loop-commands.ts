import { loadConfig } from "@nextclaw/core";
import type { Command } from "commander";
import { readLearningLoopRuntimeConfig } from "./learning-loop.config.js";

type LearningLoopCommandRuntime = {
  configSet: (
    pathExpr: string,
    value: string,
    opts?: { json?: boolean },
  ) => Promise<void>;
};

function readLearningLoopThresholdOrExit(value: string): number {
  const threshold = Number.parseInt(value, 10);
  if (!Number.isInteger(threshold) || threshold < 1) {
    console.error(
      `Invalid learning loop threshold: ${value}. Expected an integer >= 1.`,
    );
    process.exit(1);
  }
  return threshold;
}

export function registerLearningLoopCommands(
  program: Command,
  runtime: LearningLoopCommandRuntime,
): void {
  const learningLoop = program
    .command("learning-loop")
    .description("Manage the learning loop");

  learningLoop
    .command("status")
    .description("Show current learning loop settings")
    .option("--json", "Output JSON", false)
    .action((opts: { json?: boolean }) => {
      const status = readLearningLoopRuntimeConfig(loadConfig());
      if (opts.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }
      console.log("Learning loop");
      console.log(`  enabled: ${status.enabled}`);
      console.log(`  toolCallThreshold: ${status.toolCallThreshold}`);
    });

  learningLoop
    .command("enable")
    .description("Enable the learning loop")
    .action(async () => {
      await runtime.configSet("agents.learningLoop.enabled", "true", {
        json: true,
      });
      console.log("✓ Enabled learning loop.");
    });

  learningLoop
    .command("disable")
    .description("Disable the learning loop")
    .action(async () => {
      await runtime.configSet("agents.learningLoop.enabled", "false", {
        json: true,
      });
      console.log("✓ Disabled learning loop.");
    });

  learningLoop
    .command("threshold <count>")
    .description("Set the tool-call threshold that triggers a learning-loop review")
    .action(async (count: string) => {
      const threshold = readLearningLoopThresholdOrExit(count);
      await runtime.configSet(
        "agents.learningLoop.toolCallThreshold",
        String(threshold),
        { json: true },
      );
      console.log(
        `✓ Updated learning loop tool-call threshold to ${threshold}.`,
      );
    });
}

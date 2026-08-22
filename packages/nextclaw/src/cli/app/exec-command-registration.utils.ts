import type { Command } from "commander";
import type { NextclawServiceRuntime } from "@nextclaw/service";
import {
  executeExecCommand,
  type ExecCommandOptions,
} from "./controllers/exec-command.controller.js";

export function registerExecCommand(
  program: Command,
  nextclaw: NextclawServiceRuntime,
): void {
  program
    .command("exec [prompt...]")
    .description("Run one non-interactive agent task")
    .option("--agent <id>", "Agent id")
    .option("--session <id>", "Session id to resume")
    .option("--model <model>", "Session model override")
    .option("--format <format>", "Output format: text, json, or jsonl", "text")
    .option("--timeout <ms>", "Cancel after this many milliseconds")
    .action(
      async (prompt: string[] | undefined, options: ExecCommandOptions) => {
        process.exitCode = await executeExecCommand(
          nextclaw,
          prompt ?? [],
          options,
        );
      },
    );
}

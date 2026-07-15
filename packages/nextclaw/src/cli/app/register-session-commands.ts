import type { Command } from "commander";
import type { NextclawServiceRuntime } from "@nextclaw/service";

export function registerSessionCommands(
  program: Command,
  nextclaw: NextclawServiceRuntime,
): void {
  const commands = nextclaw.commands.sessions;
  const sessions = program.command("sessions").description("Manage sessions");

  sessions
    .command("rename <session-id> <label>")
    .description("Rename a session")
    .option("--json", "Output JSON", false)
    .action((sessionId, label, options) => commands.rename(sessionId, label, options));

  sessions
    .command("set-project <session-id> <directory>")
    .description("Bind a session to an existing project directory")
    .option("--json", "Output JSON", false)
    .action((sessionId, directory, options) => commands.setProject(sessionId, directory, options));

  sessions
    .command("clear-project <session-id>")
    .description("Clear a session project binding")
    .option("--json", "Output JSON", false)
    .action((sessionId, options) => commands.clearProject(sessionId, options));
}

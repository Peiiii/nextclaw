import type { Command } from "commander";
import type { NextclawServiceRuntime } from "@nextclaw/service";
import { getSessionsPath } from "@nextclaw/core";
import { compactSessionJournal, restoreSessionJournalBackup } from "@nextclaw/kernel";
import { join } from "node:path";

export function registerSessionCommands(
  program: Command,
  nextclaw: NextclawServiceRuntime,
): void {
  const commands = nextclaw.commands.sessions;
  const sessions = program.command("sessions").description("Manage sessions");

  sessions
    .command("pin <session-id>")
    .description("Persistently pin a session")
    .option("--json", "Output JSON", false)
    .action((sessionId, options) => commands.setPinned(sessionId, true, options));

  sessions
    .command("unpin <session-id>")
    .description("Remove a session pin")
    .option("--json", "Output JSON", false)
    .action((sessionId, options) => commands.setPinned(sessionId, false, options));

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

  sessions
    .command("delete <session-id>")
    .description("Permanently delete a session")
    .requiredOption("--confirm <session-id>", "Confirm the exact session id")
    .option("--json", "Output JSON", false)
    .action((sessionId, options) => commands.delete(sessionId, options));

  sessions
    .command("compact-journal <session-id>")
    .description("Inspect or explicitly compact a local session journal while all writers are stopped")
    .option("--apply", "Replace the journal after verification", false)
    .option("--restore", "Restore the original journal from its retained backup", false)
    .option("--writers-stopped", "Acknowledge that every instance using this HOME is stopped", false)
    .action(async (sessionId: string, options: { apply: boolean; restore: boolean; writersStopped: boolean }) => {
      const { apply, restore, writersStopped: acknowledgedStopped } = options;
      if (apply && restore) throw new Error("Choose either --apply or --restore.");
      const journalDir = join(getSessionsPath(), ".ncp-agent-journal");
      const writersStopped = acknowledgedStopped ? true as const : undefined;
      const result = restore
        ? await restoreSessionJournalBackup({ journalDir, sessionId, writersStopped })
        : await compactSessionJournal({ journalDir, sessionId, apply, writersStopped });
      process.stdout.write(`${JSON.stringify(result)}\n`);
    });
}

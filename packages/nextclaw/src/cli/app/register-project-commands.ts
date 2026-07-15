import type { Command } from "commander";
import type { NextclawServiceRuntime } from "@nextclaw/service";

export function registerProjectCommands(
  program: Command,
  nextclaw: NextclawServiceRuntime,
): void {
  const commands = nextclaw.commands.projects;
  const projects = program.command("projects").description("Manage projects");

  projects
    .command("list")
    .description("List registered projects, including projects without sessions")
    .option("--json", "Output JSON", false)
    .action((options) => commands.list(options));

  projects
    .command("templates")
    .description("List built-in project templates")
    .option("--json", "Output JSON", false)
    .action((options) => commands.templates(options));

  projects
    .command("create <name>")
    .description("Create and register a project")
    .option("--path <directory>", "Target directory")
    .option("--template <template>", "Project template: empty or knowledge-base", "empty")
    .option("--json", "Output JSON", false)
    .action((name, options) => commands.create(name, options));
}

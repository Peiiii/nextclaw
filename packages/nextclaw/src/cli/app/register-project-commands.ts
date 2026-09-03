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
    .description(
      "List registered projects, including projects without sessions",
    )
    .option("--json", "Output JSON", false)
    .action((options) => commands.list(options));

  projects
    .command("templates")
    .description("List built-in project templates")
    .option("--json", "Output JSON", false)
    .action((options) => commands.templates(options));

  projects
    .command("observe <root-path>")
    .description("Observe a registered project without changing project data")
    .option("--json", "Output JSON", false)
    .action((rootPath, options) => commands.observe(rootPath, options));

  projects
    .command("create <name>")
    .description("Create and register a project")
    .option("--path <directory>", "Target directory")
    .option(
      "--template <template>",
      "Project template: empty or knowledge-base",
      "empty",
    )
    .option("--json", "Output JSON", false)
    .action((name, options) => commands.create(name, options));

  registerProjectWorkCommands(projects, commands);
}

function registerProjectWorkCommands(
  projects: Command,
  commands: NextclawServiceRuntime["commands"]["projects"],
): void {
  const work = projects
    .command("work")
    .description("Manage persistent project work items");
  work
    .command("list")
    .description("List work items")
    .requiredOption("--project <id>", "Project id")
    .option("--include-deleted", "Include deleted work items", false)
    .option("--state <id>", "Only work items in this state")
    .option("--cursor <cursor>", "Opaque cursor from a previous page")
    .option("--limit <count>", "Page size from 1 to 100", "20")
    .option("--json", "Output JSON", false)
    .action((options) => commands.workList(options));
  work
    .command("get <work-item-id>")
    .description("Show a work item")
    .requiredOption("--project <id>", "Project id")
    .option("--json", "Output JSON", false)
    .action((workItemId, options) => commands.workGet(workItemId, options));
  work
    .command("create <title>")
    .description("Create a work item")
    .requiredOption("--project <id>", "Project id")
    .option("--description <text>", "Description")
    .option("--state <id>", "Initial state id")
    .option("--attention <value>", "Attention: none, blocked, or awaiting-user")
    .option("--json", "Output JSON", false)
    .action((title, options) => commands.workCreate(title, options));
  work
    .command("update <work-item-id>")
    .description("Update fields or move a work item")
    .requiredOption("--project <id>", "Project id")
    .option("--title <text>", "New title")
    .option("--description <text>", "New description")
    .option("--state <id>", "New state id")
    .option("--attention <value>", "Attention: none, blocked, or awaiting-user")
    .option("--version <number>", "Expected version")
    .option("--json", "Output JSON", false)
    .action((workItemId, options) => commands.workUpdate(workItemId, options));
  work
    .command("delete <work-item-id>")
    .description("Soft-delete a work item")
    .requiredOption("--project <id>", "Project id")
    .option("--json", "Output JSON", false)
    .action((workItemId, options) => commands.workDelete(workItemId, options));
  work
    .command("restore <work-item-id>")
    .description("Restore a deleted work item")
    .requiredOption("--project <id>", "Project id")
    .option("--json", "Output JSON", false)
    .action((workItemId, options) => commands.workRestore(workItemId, options));
  work
    .command("activity <work-item-id>")
    .description("Show immutable work item activity")
    .requiredOption("--project <id>", "Project id")
    .option("--limit <number>", "Maximum entries", "50")
    .option("--json", "Output JSON", false)
    .action((workItemId, options) =>
      commands.workActivity(workItemId, options),
    );

  const artifact = work
    .command("artifact")
    .description("Manage work item artifact links");
  artifact
    .command("link <work-item-id> <path>")
    .description("Link a project file to a work item")
    .requiredOption("--project <id>", "Project id")
    .option("--label <text>", "Display label")
    .option("--json", "Output JSON", false)
    .action((workItemId, path, options) =>
      commands.workArtifactLink(workItemId, path, options),
    );
  artifact
    .command("unlink <work-item-id> <artifact-link-id>")
    .description("Remove a work item artifact link")
    .requiredOption("--project <id>", "Project id")
    .option("--json", "Output JSON", false)
    .action((workItemId, artifactLinkId, options) =>
      commands.workArtifactUnlink(workItemId, artifactLinkId, options),
    );

  const states = work
    .command("state")
    .description("Manage project work states");
  states
    .command("list")
    .description("List project work states")
    .requiredOption("--project <id>", "Project id")
    .option("--json", "Output JSON", false)
    .action((options) => commands.workStateList(options));
  states
    .command("create <name>")
    .description("Create a project work state")
    .requiredOption("--project <id>", "Project id")
    .requiredOption(
      "--category <category>",
      "backlog, unstarted, started, completed, or canceled",
    )
    .option("--position <number>", "Sort position")
    .option("--default", "Use as default state", false)
    .option("--json", "Output JSON", false)
    .action((name, options) => commands.workStateCreate(name, options));
  states
    .command("update <state-id>")
    .description("Update a project work state")
    .requiredOption("--project <id>", "Project id")
    .option("--name <text>", "New name")
    .option("--category <category>", "New lifecycle category")
    .option("--position <number>", "New sort position")
    .option("--default", "Use as default state", false)
    .option("--json", "Output JSON", false)
    .action((stateId, options) => commands.workStateUpdate(stateId, options));
  states
    .command("delete <state-id>")
    .description("Delete a state, optionally migrating its work items")
    .requiredOption("--project <id>", "Project id")
    .option(
      "--migrate-to <state-id>",
      "Destination state for existing work items",
    )
    .option("--json", "Output JSON", false)
    .action((stateId, options) => commands.workStateDelete(stateId, options));
}

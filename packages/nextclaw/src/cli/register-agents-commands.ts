import type { Command } from "commander";
import type { CliRuntime } from "./runtime.js";

export function registerAgentsCommands(program: Command, runtime: CliRuntime): void {
  const agents = program.command("agents").description("Manage agents");

  agents
    .command("list")
    .description("List available agents")
    .option("--json", "Output JSON", false)
    .action((opts) => runtime.agentsList(opts));

  agents
    .command("new <agentId>")
    .description("Create a new agent")
    .option("--name <name>", "Agent display name")
    .option("--description <description>", "Agent description")
    .option("--avatar <avatar>", "Remote avatar URL or local image path")
    .option("--home <path>", "Agent home directory")
    .option("--json", "Output JSON", false)
    .action(async (agentId, opts) => runtime.agentsNew(agentId, opts));

  agents
    .command("update <agentId>")
    .description("Update an existing agent")
    .option("--name <name>", "Agent display name")
    .option("--description <description>", "Agent description")
    .option("--avatar <avatar>", "Remote avatar URL or local image path")
    .option("--json", "Output JSON", false)
    .action(async (agentId, opts) => runtime.agentsUpdate(agentId, opts));

  agents
    .command("remove <agentId>")
    .description("Remove an agent")
    .option("--json", "Output JSON", false)
    .action(async (agentId, opts) => runtime.agentsRemove(agentId, opts));
}

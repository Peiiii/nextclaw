import type { Command } from "commander";
import type { NextclawServiceRuntime } from "@nextclaw/service";

export function registerAgentsCommands(program: Command, nextclaw: NextclawServiceRuntime): void {
  const agentsCommands = nextclaw.commands.agents;
  const agents = program.command("agents").description("Manage agents");

  agents
    .command("list")
    .description("List available agents")
    .option("--json", "Output JSON", false)
    .action((opts) => agentsCommands.list(opts));

  agents
    .command("runtimes")
    .description("List available agent runtimes")
    .option("--probe", "Actively probe runtime readiness", false)
    .option("--json", "Output JSON", false)
    .action(async (opts) => agentsCommands.runtimes(opts));

  agents
    .command("new <agentId>")
    .description("Create a new agent")
    .option("--name <name>", "Agent display name")
    .option("--description <description>", "Agent description")
    .option("--avatar <avatar>", "Remote avatar URL or local image path")
    .option("--home <path>", "Agent home directory")
    .option("--runtime <runtime>", "Agent runtime kind, for example native or codex")
    .option("--json", "Output JSON", false)
    .action(async (agentId, opts) => agentsCommands.create(agentId, opts));

  agents
    .command("update <agentId>")
    .description("Update an existing agent")
    .option("--name <name>", "Agent display name")
    .option("--description <description>", "Agent description")
    .option("--avatar <avatar>", "Remote avatar URL or local image path")
    .option("--runtime <runtime>", "Agent runtime kind, for example native or codex")
    .option("--json", "Output JSON", false)
    .action(async (agentId, opts) => agentsCommands.update(agentId, opts));

  agents
    .command("remove <agentId>")
    .description("Remove an agent")
    .option("--json", "Output JSON", false)
    .action(async (agentId, opts) => agentsCommands.remove(agentId, opts));
}

import { Command } from "commander";

/** Load the standalone public owner only when this Node-22 capability is requested. */
export function registerCollaborationCommand(program: Command): void {
  program
    .command("collaboration")
    .description(
      "Connect external conversations to local agents (Node.js 22.13+)",
    )
    .helpOption(false)
    .allowUnknownOption()
    .argument("[args...]")
    .action(async (args: string[]) => {
      const [major, minor] = process.versions.node.split(".").map(Number);
      if (major < 22 || (major === 22 && minor < 13))
        throw new Error("Collaboration requires Node.js 22.13 or newer");
      const { registerCollaborationCommands } =
        await import("@nextclaw/collaboration");
      const command = new Command().name("nextclaw collaboration");
      registerCollaborationCommands(command);
      await command.parseAsync(args, { from: "user" });
    });
}

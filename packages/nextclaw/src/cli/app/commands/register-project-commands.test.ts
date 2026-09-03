import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import { registerProjectCommands } from "@nextclaw-cli/cli/app/register-project-commands.js";

describe("registerProjectCommands", () => {
  it("does not register the removed observation command", () => {
    const program = new Command();
    registerProjectCommands(program, {
      commands: { projects: {} },
    } as never);

    const projects = program.commands.find(
      (command) => command.name() === "projects",
    );
    expect(projects?.commands.map((command) => command.name())).not.toContain(
      "observe",
    );
  });

  it("forwards the explicit project removal confirmation", async () => {
    const remove = vi.fn(async () => undefined);
    const program = new Command();
    program.exitOverride();
    registerProjectCommands(program, {
      commands: { projects: { remove } },
    } as never);

    await program.parseAsync([
      "node",
      "nextclaw",
      "projects",
      "remove",
      "project-1",
      "--confirm",
      "project-1",
    ]);

    expect(remove).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ confirm: "project-1" }),
    );
  });

  it("forwards bounded work-list pagination options", async () => {
    const workList = vi.fn(async () => undefined);
    const program = new Command();
    program.exitOverride();
    registerProjectCommands(program, {
      commands: { projects: { workList } },
    } as never);

    await program.parseAsync([
      "node",
      "nextclaw",
      "projects",
      "work",
      "list",
      "--project",
      "project-1",
      "--state",
      "review",
      "--cursor",
      "next",
      "--limit",
      "25",
      "--include-deleted",
    ]);

    expect(workList).toHaveBeenCalledWith(
      expect.objectContaining({
        project: "project-1",
        state: "review",
        cursor: "next",
        limit: "25",
        includeDeleted: true,
      }),
    );
  });
});

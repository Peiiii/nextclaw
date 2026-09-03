import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import { registerProjectCommands } from "@nextclaw-cli/cli/app/register-project-commands.js";

describe("registerProjectCommands", () => {
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

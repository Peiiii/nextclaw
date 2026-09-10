import { Command } from "commander";
import { expect, it, vi } from "vitest";
import { registerResourceCommands } from "./resource-command-registration.utils.js";

it("uses the public live API for discovery and exact URI resolution", async () => {
  const request = vi.fn(async () => ({ groups: [] }));
  const output = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const program = new Command();
    registerResourceCommands(program, () => ({ request }) as never);
    await program.parseAsync(
      [
        "resources",
        "list",
        "--type",
        "skill",
        "--query",
        "hello world",
        "--limit",
        "10",
      ],
      { from: "user" },
    );
    expect(request).toHaveBeenLastCalledWith({
      path: "/api/system-object-references?objectType=skill&query=hello+world&limit=10",
    });
    await program.parseAsync(
      ["resources", "resolve", "nextclaw://objects/cron-job/job-1"],
      { from: "user" },
    );
    expect(request).toHaveBeenLastCalledWith({
      path: "/api/system-object-references/resolve",
      method: "POST",
      body: { uri: "nextclaw://objects/cron-job/job-1" },
    });
  } finally {
    output.mockRestore();
  }
});

it("does not create another runtime when the service is unavailable", async () => {
  const program = new Command();
  registerResourceCommands(program, () => null);
  await expect(
    program.parseAsync(["resources", "list"], { from: "user" }),
  ).rejects.toThrow("No local NextClaw service");
});

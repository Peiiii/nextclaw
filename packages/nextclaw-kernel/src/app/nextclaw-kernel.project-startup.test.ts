import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";

describe("NextclawKernel project startup", () => {
  it("does not list every session to discover projects", async () => {
    const homeDirectory = await mkdtemp(
      join(tmpdir(), "nextclaw-project-startup-"),
    );
    const configPath = join(homeDirectory, "config.json");
    saveConfig(
      ConfigSchema.parse({
        agents: {
          defaults: { workspace: join(homeDirectory, "workspace") },
        },
      }),
      configPath,
    );
    const kernel = new NextclawKernel({ configPath, homeDir: homeDirectory });
    const listSessions = vi.spyOn(kernel.sessionManager, "listSessions");

    try {
      await kernel.start();
      expect(listSessions).not.toHaveBeenCalled();
    } finally {
      await kernel.dispose();
      await rm(homeDirectory, { recursive: true, force: true });
    }
  });
});

import { describe, expect, it } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import { McpManager } from "@kernel/managers/mcp.manager.js";

describe("McpManager contributed servers", () => {
  it("adds an in-memory server overlay and removes it without changing base config", async () => {
    const config = ConfigSchema.parse({});
    const manager = new McpManager(() => config);
    const definition = ConfigSchema.parse({
      mcp: {
        servers: {
          fixture: {
            enabled: false,
            transport: {
              type: "stdio",
              command: "fixture-command",
            },
          },
        },
      },
    }).mcp.servers.fixture;

    const dispose = await manager.registerServer("fixture", definition);
    expect(manager.listServers().map(({ name }) => name)).toContain("fixture");
    expect(config.mcp.servers.fixture).toBeUndefined();

    await dispose();
    expect(manager.listServers().map(({ name }) => name)).not.toContain(
      "fixture",
    );

    const disposeReplacement = await manager.registerServer("fixture", definition);
    await dispose();
    expect(manager.listServers().map(({ name }) => name)).toContain("fixture");
    await disposeReplacement();
    await manager.dispose();
  });
});

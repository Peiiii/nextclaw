import { describe, expect, it, vi } from "vitest";
import { McpServerLifecycleManager } from "../src/lifecycle/mcp-server-lifecycle-manager.js";

describe("McpServerLifecycleManager", () => {
  it("passes abort signals to MCP tool requests", async () => {
    const callTool = vi.fn(async () => ({ content: [] }));
    const client = {
      callTool,
      connect: vi.fn(async () => {}),
      listTools: vi.fn(async () => ({
        tools: [
          {
            name: "slow",
            inputSchema: { type: "object" },
          },
        ],
      })),
    };
    const transport = { close: vi.fn(async () => {}) };
    const manager = new McpServerLifecycleManager({
      clientFactory: {
        create: () => ({ client, transport }),
      } as unknown as ConstructorParameters<typeof McpServerLifecycleManager>[0]["clientFactory"],
      getConfig: () => ({}) as never,
    });
    const controller = new AbortController();

    await manager.callTool({
      definition: {
        enabled: true,
        policy: { start: "eager", trust: "explicit" },
        scope: { agents: [], allAgents: true },
        transport: { type: "stdio", command: "mock", args: [], env: {}, stderr: "pipe" },
      },
      name: "demo",
    }, "slow", {}, { signal: controller.signal });

    expect(callTool).toHaveBeenCalledWith({
      name: "slow",
      arguments: {},
    }, undefined, { signal: controller.signal });
  });
});

import { describe, expect, it, vi } from "vitest";
import { McpNcpToolRegistryAdapter } from "./mcp-ncp-tool-registry-adapter.js";

describe("McpNcpToolRegistryAdapter", () => {
  it("maps cached MCP tools into executable NCP tools", async () => {
    const callTool = vi.fn(async () => ({
      content: [
        {
          type: "text",
          text: "echo:adapter"
        }
      ]
    }));
    const registryService = {
      listAccessibleTools: vi.fn(() => [
        {
          qualifiedName: "mcp_demo__echo",
          serverName: "demo",
          toolName: "echo",
          description: "Echo tool",
          parameters: {
            type: "object",
            properties: {
              text: {
                type: "string"
              }
            }
          }
        }
      ]),
      callTool
    } as unknown as ConstructorParameters<typeof McpNcpToolRegistryAdapter>[0];

    const adapter = new McpNcpToolRegistryAdapter(registryService);
    const tools = adapter.listToolsForRun({
      agentId: "main"
    });

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe("mcp_demo__echo");

    const result = await tools[0]?.execute({
      text: "adapter"
    });

    expect(callTool).toHaveBeenCalledWith({
      serverName: "demo",
      toolName: "echo",
      args: {
        text: "adapter"
      },
      signal: undefined,
    });
    expect(result).toMatchObject({
      content: [
        {
          text: "echo:adapter"
        }
      ]
    });
  });

  it("passes tool abort signals to MCP calls", async () => {
    const callTool = vi.fn(async () => ({ content: [] }));
    const registryService = {
      listAccessibleTools: vi.fn(() => [
        {
          qualifiedName: "mcp_demo__slow",
          serverName: "demo",
          toolName: "slow"
        }
      ]),
      callTool
    } as unknown as ConstructorParameters<typeof McpNcpToolRegistryAdapter>[0];
    const controller = new AbortController();
    const adapter = new McpNcpToolRegistryAdapter(registryService);
    const [tool] = adapter.listToolsForRun({ agentId: "main" });

    await tool?.execute({}, {
      abortSignal: controller.signal,
      toolCallId: "call-1",
    });

    expect(callTool).toHaveBeenCalledWith({
      serverName: "demo",
      toolName: "slow",
      args: {},
      signal: controller.signal,
    });
  });
});

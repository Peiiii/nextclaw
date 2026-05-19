import {
  Tool,
  type Config,
  type SearchConfig,
  type ToolExecutionContext,
} from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";
import { describe, expect, it, vi } from "vitest";
import { ToolManager, type ToolRunContext } from "./tool.manager.js";

class EchoTool extends Tool {
  readonly name = "echo";
  readonly description = "Echo input for tests.";
  readonly parameters = {
    type: "object",
    properties: {
      value: { type: "string" },
    },
    required: ["value"],
  };

  execute = async (
    params: Record<string, unknown>,
    _context: ToolExecutionContext,
  ): Promise<unknown> => ({ value: params.value });
}

class HiddenTool extends EchoTool {
  override readonly name = "hidden";

  override isAvailable = (): boolean => false;
}

class DirectNcpTool implements NcpTool {
  readonly name = "direct";
  readonly description = "Direct NCP tool for tests.";
  readonly parameters = {
    type: "object",
    properties: {
      value: { type: "string" },
    },
  };

  execute = async (args: unknown): Promise<unknown> => ({ args });
}

function createToolRunContext(): ToolRunContext {
  return {
    agentId: "default",
    channel: "test",
    chatId: "chat",
    config: {} as Config,
    execTimeoutSeconds: 30,
    handoffDepth: 0,
    metadata: {},
    restrictToWorkspace: true,
    searchConfig: {} as SearchConfig,
    sessionId: "session",
    workspace: "/tmp/nextclaw-tool-manager-test",
  };
}

describe("ToolManager", () => {
  it("provides registered tools to runtime registries", async () => {
    const manager = new ToolManager();
    manager.provideTools({
      id: "test-tools",
      registerTools: (_context, registry) => {
        registry.registerTool(new EchoTool());
        registry.registerNcpTool(new DirectNcpTool());
      },
    });

    const runtimeRegistry = manager.createRuntimeRegistry({
      updateToolCallResult: vi.fn(),
    });
    runtimeRegistry.prepareForRun(createToolRunContext());

    expect(runtimeRegistry.getToolDefinitions().map((tool) => tool.name)).toEqual([
      "echo",
      "direct",
    ]);
    await expect(runtimeRegistry.execute("call", "echo", { value: "ok" })).resolves.toEqual({
      value: "ok",
    });
    await expect(runtimeRegistry.execute("call", "direct", { value: "ok" })).resolves.toEqual({
      args: { value: "ok" },
    });
  });

  it("removes provider tools after disposal", () => {
    const manager = new ToolManager();
    const registration = manager.provideTools({
      id: "temporary-tools",
      registerTools: (_context, registry) => registry.registerTool(new EchoTool()),
    });

    registration.dispose();
    const runtimeRegistry = manager.createRuntimeRegistry({
      updateToolCallResult: vi.fn(),
    });
    runtimeRegistry.prepareForRun(createToolRunContext());

    expect(runtimeRegistry.getToolDefinitions()).toEqual([]);
  });

  it("filters unavailable core tools from runtime definitions", () => {
    const manager = new ToolManager();
    manager.provideTools({
      id: "hidden-tools",
      registerTools: (_context, registry) => registry.registerTool(new HiddenTool()),
    });

    const runtimeRegistry = manager.createRuntimeRegistry({
      updateToolCallResult: vi.fn(),
    });
    runtimeRegistry.prepareForRun(createToolRunContext());

    expect(runtimeRegistry.getToolDefinitions()).toEqual([]);
    expect(runtimeRegistry.getTool("hidden")).toBeUndefined();
  });
});

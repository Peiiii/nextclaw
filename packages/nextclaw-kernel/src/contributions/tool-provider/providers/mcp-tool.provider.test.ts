import { describe, expect, it, vi } from "vitest";
import type { ToolProviderRunContextService } from "@kernel/contributions/tool-provider/services/tool-provider-run-context.service.js";
import type { FeatureControlsService } from "@kernel/features/feature-controls/index.js";
import type { McpManager } from "@kernel/managers/mcp.manager.js";
import { McpToolProvider } from "./mcp-tool.provider.js";

const runContextService = {
  resolve: vi.fn(async () => ({ toolRunContext: { agentId: "agent-1" } })),
} as never as ToolProviderRunContextService;

const mcpManager = {
  listToolsForRun: vi.fn(async () => [{ name: "mcp_tool" }]),
} as never as McpManager;

const featureControlsWith = (mcpActive: boolean): FeatureControlsService =>
  ({
    get: async () => ({
      desktopAutomation: { available: true, active: mcpActive },
      mcp: { available: true, active: mcpActive },
      core: { healthy: mcpActive, autoDegrade: !mcpActive, failedCheckIds: mcpActive ? [] : ["provider"] },
    }),
  }) as never as FeatureControlsService;

describe("McpToolProvider degrade gate", () => {
  it("returns no tools when mcp is deactivated by core degradation", async () => {
    const provider = new McpToolProvider(runContextService, mcpManager, featureControlsWith(false));

    await expect(provider.provide({} as never)).resolves.toEqual([]);
    expect(mcpManager.listToolsForRun).not.toHaveBeenCalled();
  });

  it("keeps exposing tools when mcp stays active (default behavior)", async () => {
    const provider = new McpToolProvider(runContextService, mcpManager, featureControlsWith(true));

    const tools = await provider.provide({} as never);
    expect(tools).toHaveLength(1);
    expect(mcpManager.listToolsForRun).toHaveBeenCalledOnce();
  });
});

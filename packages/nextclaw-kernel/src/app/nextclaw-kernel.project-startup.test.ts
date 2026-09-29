import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createLocalProductFixture } from "@kernel/utils/tests/local-product-fixture.utils.js";

describe("NextclawKernel project startup", () => {
  it("shares the AgentKernel capability owners with the full local product", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "nextclaw-capabilities-"));
    const configPath = join(homeDir, "config.json");
    saveConfig(ConfigSchema.parse({ agents: { defaults: { workspace: join(homeDir, "workspace") } } }), configPath);
    const { kernel, harness } = await createLocalProductFixture({ configPath, homeDir });
    try {
      expect(kernel.capabilities.context).toBe(kernel.contextProviderManager);
      expect(kernel.capabilities.mcp).toBe(kernel.mcpManager);
      expect(kernel.capabilities.eventBus).toBe(kernel.eventBus);
      expect(kernel.capabilities.models.registerProvider).toBe(kernel.llmProviders.registerProviderPlugin);
      expect(kernel.capabilities.models.listProviders()).toEqual(kernel.llmProviders.listProviderSpecs());
      const request = { message: { id: "test", sessionId: "test", role: "user" as const,
        status: "final" as const, parts: [], timestamp: new Date().toISOString() } };
      const remove = kernel.capabilities.context.register({ provide: () => ["shared context"] });
      expect(await kernel.contextProviderManager.buildContext(request)).toContain("shared context");
      remove();
      expect(await kernel.contextProviderManager.buildContext(request)).not.toContain("shared context");
      const register = vi.spyOn(kernel.toolProviderManager, "register");
      const tool = { name: "test", description: "test", parameters: { type: "object", properties: {} }, execute: async () => "ok" };
      const removeTool = kernel.capabilities.tools.register(tool);
      expect(await register.mock.calls[0]?.[0].provide(request)).toContain(tool);
      removeTool();
      const mcpTools = vi.spyOn(kernel.mcpManager, "listToolsForRun").mockReturnValue([{ ...tool, name: "mcp_test" }]);
      const structuredRequest = { ...request, message: { ...request.message, metadata: {
        structured_result: { request_id: "result-1", tool_name: "nextclaw_submit_result",
          schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] } },
      } } };
      const tools = await kernel.toolProviderManager.buildTools(structuredRequest);
      expect(tools.filter((item) => item.name === "nextclaw_submit_result")).toHaveLength(1);
      expect(tools.filter((item) => item.name === "mcp_test")).toHaveLength(1);
      expect(mcpTools).toHaveBeenCalledExactlyOnceWith({ agentId: "main" });
      expect((await kernel.toolProviderManager.buildTools(request)).some((item) => item.name === "nextclaw_submit_result")).toBe(false);
      await expect(kernel.capabilities.models.chatStream({ messages: [] }).next()).rejects.toThrow("No API key configured");
    } finally {
      await harness.dispose();
      await rm(homeDir, { recursive: true, force: true });
    }
  });

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
    const { kernel, harness } = await createLocalProductFixture({ configPath, homeDir: homeDirectory });
    const listSessions = vi.spyOn(kernel.sessionManager, "listSessions");
    const flush = vi.spyOn(kernel.sessionManager, "flushSessionEvents");
    const closeSessions = vi.spyOn(kernel.sessionManager, "dispose");
    const closeExtensions = vi.spyOn(kernel.extensions, "dispose");
    const closeRuntime = vi.spyOn(kernel.agentRuntimeManager, "dispose");
    const closeApps = vi.spyOn(kernel.serviceAppManager, "dispose");

    try {
      await harness.start();
      expect(listSessions).not.toHaveBeenCalled();
    } finally {
      await harness.dispose();
      expect(flush).toHaveBeenCalledOnce();
      expect(closeSessions).toHaveBeenCalledOnce();
      expect(flush.mock.invocationCallOrder[0]).toBeLessThan(closeSessions.mock.invocationCallOrder[0]!);
      expect(closeExtensions.mock.invocationCallOrder[0]).toBeLessThan(closeRuntime.mock.invocationCallOrder[0]!);
      expect(closeRuntime.mock.invocationCallOrder[0]).toBeLessThan(closeApps.mock.invocationCallOrder[0]!);
      await rm(homeDirectory, { recursive: true, force: true });
    }
  });
});

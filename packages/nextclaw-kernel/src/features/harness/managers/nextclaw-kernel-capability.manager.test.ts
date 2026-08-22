import { describe, expect, it, vi } from "vitest";
import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { EventBus, Ingress } from "@nextclaw/shared";
import { NextclawKernelFacade } from "./nextclaw-kernel-capability.manager.js";

function createKernelFixture() {
  return {
    eventBus: new EventBus(),
    ingress: new Ingress(),
    toolProviderManager: { register: vi.fn(() => vi.fn()) },
    contextProviderManager: { register: vi.fn(() => vi.fn()) },
    llmProviders: {
      registerProviderPlugin: vi.fn(() => vi.fn()),
      listProviderSpecs: vi.fn(() => []),
      chat: vi.fn(),
      chatStream: vi.fn(),
    },
    agentRuntimeManager: {
      registerProvider: vi.fn(() => vi.fn()),
      registerEntry: vi.fn(() => vi.fn()),
      listSessionTypes: vi.fn(),
    },
    mcpManager: {
      registerServer: vi.fn(),
      listServers: vi.fn(() => []),
      listTools: vi.fn(() => []),
      callTool: vi.fn(),
    },
    assetStore: { resolveContentPath: vi.fn() },
  };
}

describe("NextclawKernelFacade", () => {
  it("exposes every first-batch platform composition capability", () => {
    const kernel = createKernelFixture();
    const facade = new NextclawKernelFacade(
      kernel as unknown as NextclawKernel,
    );

    expect(facade.eventBus).toBe(kernel.eventBus);
    expect(facade.ingress).toBe(kernel.ingress);

    const tool = { name: "fixture" } as never;
    facade.tools.register(tool);
    const toolProvider = kernel.toolProviderManager.register.mock.calls[0]?.[0];
    expect(toolProvider?.provide()).toEqual([tool]);

    const contextProvider = { provide: () => ["context"] };
    facade.context.register(contextProvider as never);
    expect(kernel.contextProviderManager.register).toHaveBeenCalledWith(
      contextProvider,
    );

    const plugin = { id: "fixture", providers: [] };
    facade.models.registerProvider(plugin);
    expect(kernel.llmProviders.registerProviderPlugin).toHaveBeenCalledWith(
      plugin,
    );

    const entry = { id: "fixture", type: "fixture", label: "Fixture" };
    facade.runtimes.registerEntry(entry);
    expect(kernel.agentRuntimeManager.registerEntry).toHaveBeenCalledWith(entry);

    expect(typeof facade.mcp.registerServer).toBe("function");
  });
});

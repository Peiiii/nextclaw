import { describe, expect, it, vi } from "vitest";
import { ExtensionHostProxyRegistryService } from "./extension-host-proxy-registry.service.js";

describe("ExtensionHostProxyRegistryService", () => {
  it("keeps provider registrations in the proxy registry contract", () => {
    const service = new ExtensionHostProxyRegistryService({
      executeTool: vi.fn(),
      sendChannelOutbound: vi.fn(),
      describeRuntime: vi.fn(),
      runRuntimeStream: vi.fn(),
    });

    const registry = service.createPluginRegistry({
      plugins: [],
      diagnostics: [],
      tools: [],
      channels: [],
      providers: [
        {
          pluginId: "nextclaw-provider-demo",
          source: "/tmp/provider.js",
          provider: {
            id: "demo",
            label: "Demo Provider",
            aliases: ["demo-alias"],
          },
        },
      ],
      ncpAgentRuntimes: [],
    });

    expect(registry.providers).toEqual([
      {
        pluginId: "nextclaw-provider-demo",
        source: "/tmp/provider.js",
        provider: {
          id: "demo",
          label: "Demo Provider",
          aliases: ["demo-alias"],
        },
      },
    ]);
  });
});

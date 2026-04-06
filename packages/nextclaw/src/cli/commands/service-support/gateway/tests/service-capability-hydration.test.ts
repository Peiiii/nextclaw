import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextclawCoreModule from "@nextclaw/core";
import type * as OpenclawCompatModule from "@nextclaw/openclaw-compat";

const mocks = vi.hoisted(() => ({
  discoverPluginRegistryStatusMock: vi.fn(),
  getPluginChannelBindingsMock: vi.fn(),
  getPluginUiMetadataFromRegistryMock: vi.fn(),
  getWorkspacePathMock: vi.fn(),
  loadConfigMock: vi.fn(),
  loadPluginRegistryProgressivelyMock: vi.fn(),
  logPluginDiagnosticsMock: vi.fn(),
  resolveConfigSecretsMock: vi.fn(),
  shouldRestartChannelsForPluginReloadMock: vi.fn(),
  toExtensionRegistryMock: vi.fn(),
  waitForUiShellGraceWindowMock: vi.fn()
}));

vi.mock("@nextclaw/core", async (importOriginal) => {
  const actual = await importOriginal<typeof NextclawCoreModule>();
  return {
    ...actual,
    getWorkspacePath: mocks.getWorkspacePathMock,
    loadConfig: mocks.loadConfigMock,
    resolveConfigSecrets: mocks.resolveConfigSecretsMock
  };
});

vi.mock("@nextclaw/openclaw-compat", async (importOriginal) => {
  const actual = await importOriginal<typeof OpenclawCompatModule>();
  return {
    ...actual,
    getPluginChannelBindings: mocks.getPluginChannelBindingsMock,
    getPluginUiMetadataFromRegistry: mocks.getPluginUiMetadataFromRegistryMock
  };
});

vi.mock("../../../plugin/plugin-registry-loader.js", () => ({
  discoverPluginRegistryStatus: mocks.discoverPluginRegistryStatusMock,
  loadPluginRegistryProgressively: mocks.loadPluginRegistryProgressivelyMock
}));

vi.mock("../../../plugin/plugin-reload.js", () => ({
  shouldRestartChannelsForPluginReload: mocks.shouldRestartChannelsForPluginReloadMock
}));

vi.mock("../../../plugins.js", () => ({
  logPluginDiagnostics: mocks.logPluginDiagnosticsMock,
  toExtensionRegistry: mocks.toExtensionRegistryMock
}));

vi.mock("../service-ui-shell-grace.js", () => ({
  waitForUiShellGraceWindow: mocks.waitForUiShellGraceWindowMock
}));

import { hydrateServiceCapabilities } from "../service-capability-hydration.js";

describe("hydrateServiceCapabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.waitForUiShellGraceWindowMock.mockResolvedValue(undefined);
    mocks.loadConfigMock.mockReturnValue({
      agents: {
        defaults: {
          workspace: "~/.nextclaw/workspace"
        }
      }
    });
    mocks.resolveConfigSecretsMock.mockImplementation((config) => config);
    mocks.getWorkspacePathMock.mockReturnValue("/tmp/workspace");
    mocks.discoverPluginRegistryStatusMock.mockReturnValue({
      plugins: [{ enabled: true }]
    });
    mocks.shouldRestartChannelsForPluginReloadMock.mockReturnValue(true);
  });

  it("syncs gateway capability state before rebuilding channels", async () => {
    const nextPluginRegistry = {
      plugins: [{ id: "nextclaw-channel-weixin" }]
    };
    const nextExtensionRegistry = {
      channels: [{ channel: { id: "weixin" } }]
    };
    const nextPluginChannelBindings = [
      {
        pluginId: "nextclaw-channel-weixin",
        channelId: "weixin",
        channel: { id: "weixin" }
      }
    ];
    const nextPluginUiMetadata = [{ id: "nextclaw-channel-weixin" }];

    mocks.loadPluginRegistryProgressivelyMock.mockResolvedValue(nextPluginRegistry);
    mocks.toExtensionRegistryMock.mockReturnValue(nextExtensionRegistry);
    mocks.getPluginChannelBindingsMock.mockReturnValue(nextPluginChannelBindings);
    mocks.getPluginUiMetadataFromRegistryMock.mockReturnValue(nextPluginUiMetadata);

    const gateway = {
      runtimeConfigPath: "/tmp/config.json",
      pluginRegistry: { plugins: [] },
      extensionRegistry: { channels: [] },
      pluginChannelBindings: [],
      runtimePool: {
        applyExtensionRegistry: vi.fn(),
        applyRuntimeConfig: vi.fn()
      },
      reloader: {
        rebuildChannels: vi.fn(async () => {
          expect(gateway.pluginRegistry).toBe(nextPluginRegistry);
          expect(gateway.extensionRegistry).toBe(nextExtensionRegistry);
          expect(gateway.pluginChannelBindings).toBe(nextPluginChannelBindings);
        })
      }
    };
    const state = {
      pluginRegistry: { plugins: [] },
      extensionRegistry: { channels: [] },
      pluginChannelBindings: [],
      pluginUiMetadata: []
    };
    const bootstrapStatus = {
      markPluginHydrationRunning: vi.fn(),
      markChannelsPending: vi.fn(),
      markPluginHydrationProgress: vi.fn(),
      markPluginHydrationReady: vi.fn(),
      markPluginHydrationError: vi.fn()
    };
    const uiNcpAgent = {
      applyExtensionRegistry: vi.fn()
    };

    await hydrateServiceCapabilities({
      uiStartup: null,
      gateway: gateway as never,
      state: state as never,
      bootstrapStatus: bootstrapStatus as never,
      getLiveUiNcpAgent: () => uiNcpAgent as never
    });

    expect(gateway.pluginRegistry).toBe(nextPluginRegistry);
    expect(gateway.extensionRegistry).toBe(nextExtensionRegistry);
    expect(gateway.pluginChannelBindings).toBe(nextPluginChannelBindings);
    expect(state.pluginRegistry).toBe(nextPluginRegistry);
    expect(state.extensionRegistry).toBe(nextExtensionRegistry);
    expect(state.pluginChannelBindings).toBe(nextPluginChannelBindings);
    expect(state.pluginUiMetadata).toBe(nextPluginUiMetadata);
    expect(gateway.reloader.rebuildChannels).toHaveBeenCalledWith(
      expect.objectContaining({
        agents: expect.any(Object)
      }),
      { start: false }
    );
    expect(gateway.runtimePool.applyExtensionRegistry).toHaveBeenCalledWith(nextExtensionRegistry);
    expect(uiNcpAgent.applyExtensionRegistry).toHaveBeenCalledWith(nextExtensionRegistry);
  });
});

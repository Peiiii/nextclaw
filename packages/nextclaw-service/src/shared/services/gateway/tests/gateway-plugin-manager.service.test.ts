import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextclawCoreModule from "@nextclaw/core";
import type * as OpenclawCompatModule from "@nextclaw/openclaw-compat";

const mocks = vi.hoisted(() => ({
  discoverPluginRegistryStatusMock: vi.fn(),
  getPluginChannelBindingsMock: vi.fn(),
  getPluginUiMetadataFromRegistryMock: vi.fn(),
  getWorkspacePathMock: vi.fn(),
  loadPluginRegistryProgressivelyMock: vi.fn(),
  logPluginDiagnosticsMock: vi.fn(),
  logPluginGatewayDiagnosticsMock: vi.fn(),
  shouldRestartChannelsForPluginReloadMock: vi.fn(),
  toExtensionRegistryMock: vi.fn(),
  toPluginConfigViewMock: vi.fn(),
}));

vi.mock("@nextclaw/core", async (importOriginal) => {
  const actual = await importOriginal<typeof NextclawCoreModule>();
  return {
    ...actual,
    getWorkspacePath: mocks.getWorkspacePathMock,
  };
});

vi.mock("@nextclaw/openclaw-compat", async (importOriginal) => {
  const actual = await importOriginal<typeof OpenclawCompatModule>();
  return {
    ...actual,
    getPluginChannelBindings: mocks.getPluginChannelBindingsMock,
    getPluginUiMetadataFromRegistry: mocks.getPluginUiMetadataFromRegistryMock,
    toPluginConfigView: mocks.toPluginConfigViewMock,
  };
});

vi.mock("@nextclaw-service/commands/plugin/plugin-registry-loader.utils.js", () => ({
  discoverPluginRegistryStatus: mocks.discoverPluginRegistryStatusMock,
  loadPluginRegistryProgressively: mocks.loadPluginRegistryProgressivelyMock,
}));

vi.mock("@nextclaw-service/commands/plugin/plugin-reload.js", () => ({
  shouldRestartChannelsForPluginReload: mocks.shouldRestartChannelsForPluginReloadMock,
}));

vi.mock("@nextclaw-service/commands/plugin/index.js", () => ({
  createEmptyPluginRegistry: () => ({ plugins: [] }),
  logPluginDiagnostics: mocks.logPluginDiagnosticsMock,
  toExtensionRegistry: mocks.toExtensionRegistryMock,
}));

vi.mock("../service-startup-support.service.js", () => ({
  logPluginGatewayDiagnostics: mocks.logPluginGatewayDiagnosticsMock,
  pluginGatewayLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GatewayPluginManager } from "../managers/gateway-plugin.manager.js";
import type { NextclawGatewayRuntime } from "../nextclaw-gateway-runtime.service.js";

const createGateway = (config: Record<string, unknown> = {
  agents: { defaults: { workspace: "~/.nextclaw/workspace" } },
}): NextclawGatewayRuntime => ({
  appEventBus: {
    emit: vi.fn(),
    emitEnvelope: vi.fn(),
  },
  bootstrapStatus: {
    markChannelsPending: vi.fn(),
    markPluginHydrationError: vi.fn(),
    markPluginHydrationProgress: vi.fn(),
    markPluginHydrationReady: vi.fn(),
    markPluginHydrationRunning: vi.fn(),
  },
  liveAgentRuntime: null,
  kernel: {
    extensions: {
      loadContributions: vi.fn(),
    },
  },
  configManager: {
    loadConfig: () => config,
    rebuildChannels: vi.fn(async () => undefined),
  },
  extensions: {
    loadContributions: vi.fn(async () => ({
      channelBindings: [],
      uiMetadata: [],
    })),
  },
} as never);

describe("GatewayPluginManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspacePathMock.mockReturnValue("/tmp/workspace");
    mocks.discoverPluginRegistryStatusMock.mockReturnValue({
      plugins: [{ enabled: true }],
    });
    mocks.getPluginChannelBindingsMock.mockReturnValue([]);
    mocks.getPluginUiMetadataFromRegistryMock.mockReturnValue([]);
    mocks.shouldRestartChannelsForPluginReloadMock.mockReturnValue(true);
    mocks.toExtensionRegistryMock.mockReturnValue({ channels: [] });
    mocks.toPluginConfigViewMock.mockImplementation((config) => config);
  });

  it("owns plugin registry derived state during load", async () => {
    const gateway = createGateway();
    const manager = new GatewayPluginManager(gateway);
    const registry = { plugins: [{ id: "nextclaw-channel-test" }] };
    const extensionRegistry = { channels: [{ channel: { id: "test" } }] };
    const channelBindings = [
      {
        pluginId: "nextclaw-channel-test",
        channelId: "test",
        channel: { id: "test" },
      },
    ];
    const uiMetadata = [{ id: "nextclaw-channel-test" }];
    mocks.loadPluginRegistryProgressivelyMock.mockResolvedValue(registry);
    mocks.toExtensionRegistryMock.mockReturnValue(extensionRegistry);
    mocks.getPluginChannelBindingsMock.mockReturnValue(channelBindings);
    mocks.getPluginUiMetadataFromRegistryMock.mockReturnValue(uiMetadata);

    await manager.load();

    expect(gateway.configManager.rebuildChannels).toHaveBeenCalledTimes(1);
    expect(manager.getRegistry()).toBe(registry);
    expect(manager.getExtensionRegistry()).toEqual(extensionRegistry);
    expect(manager.getChannelBindings()).toEqual(expect.arrayContaining(channelBindings));
    expect(manager.getUiMetadata()).toEqual(expect.arrayContaining(uiMetadata));
  });

  it("merges extension manifest contributions without direct extension package imports", async () => {
    const gateway = createGateway();
    const manager = new GatewayPluginManager(gateway);
    const legacyWeixinBinding = {
      pluginId: "nextclaw-channel-plugin-weixin",
      channelId: "weixin",
      channel: { id: "weixin" },
    };
    const extensionContributions = {
      channelBindings: [{
        pluginId: "nextclaw-channel-extension-weixin",
        channelId: "weixin",
        channel: { id: "weixin" },
      }],
      uiMetadata: [{
        id: "nextclaw-channel-extension-weixin",
        configSchema: { type: "object" },
      }],
    };
    mocks.loadPluginRegistryProgressivelyMock.mockResolvedValue({ plugins: [] });
    mocks.getPluginChannelBindingsMock.mockReturnValue([legacyWeixinBinding]);
    mocks.toExtensionRegistryMock.mockReturnValue({
      channels: [{
        extensionId: "nextclaw-channel-plugin-weixin",
        channel: { id: "weixin" },
        source: "plugin",
      }],
      tools: [],
      diagnostics: [],
      ncpAgentRuntimes: [],
    });
    (gateway.extensions.loadContributions as ReturnType<typeof vi.fn>).mockResolvedValue(extensionContributions);

    await manager.load();

    expect(manager.getChannelBindings()).toEqual(extensionContributions.channelBindings);
    expect(manager.getExtensionRegistry().channels).toEqual([{
      extensionId: "nextclaw-channel-extension-weixin",
      channel: { id: "weixin" },
      source: "extension-manifest",
    }]);
    expect(manager.getUiMetadata()).toEqual(extensionContributions.uiMetadata);
  });

  it("owns plugin gateway handles", async () => {
    const gateway = createGateway({
      agents: { defaults: { workspace: "~/.nextclaw/workspace" } },
      channels: {
        test: { enabled: true },
      },
    });
    const manager = new GatewayPluginManager(gateway);
    const stop = vi.fn(async () => undefined);
    const startAccount = vi.fn(async () => ({ stop }));
    const binding = {
      pluginId: "nextclaw-channel-test",
      channelId: "test",
      channel: {
        id: "test",
        gateway: {
          startAccount,
        },
        config: {
          listAccountIds: () => ["bot"],
        },
      },
    };
    mocks.loadPluginRegistryProgressivelyMock.mockResolvedValue({ plugins: [{ id: "nextclaw-channel-test" }] });
    mocks.getPluginChannelBindingsMock.mockReturnValue([binding]);
    mocks.toPluginConfigViewMock.mockReturnValue({
      channels: {
        test: { enabled: true },
      },
    });
    await manager.load();

    await manager.startGateways();
    await manager.stopGateways();

    expect(startAccount).toHaveBeenCalledWith(expect.objectContaining({
      accountId: "bot",
      channelId: "test",
    }));
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextclawCoreModule from "@nextclaw/core";
import type * as OpenclawCompatModule from "@nextclaw/openclaw-compat";

const mocks = vi.hoisted(() => ({
  getPluginChannelBindingsMock: vi.fn(),
  getWorkspacePathMock: vi.fn(),
  loadPluginRegistryMock: vi.fn(),
  logPluginDiagnosticsMock: vi.fn(),
  shouldRestartChannelsForPluginReloadMock: vi.fn(),
  startPluginChannelGatewaysMock: vi.fn(),
  stopPluginChannelGatewaysMock: vi.fn(),
  toExtensionRegistryMock: vi.fn(),
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
    startPluginChannelGateways: mocks.startPluginChannelGatewaysMock,
    stopPluginChannelGateways: mocks.stopPluginChannelGatewaysMock,
  };
});

vi.mock("@/cli/commands/plugin/plugin-reload.js", () => ({
  shouldRestartChannelsForPluginReload: mocks.shouldRestartChannelsForPluginReloadMock,
}));

vi.mock("@/cli/commands/plugin/index.js", () => ({
  loadPluginRegistry: mocks.loadPluginRegistryMock,
  logPluginDiagnostics: mocks.logPluginDiagnosticsMock,
  toExtensionRegistry: mocks.toExtensionRegistryMock,
}));

import { reloadServicePlugins } from "./service-plugin-reload.service.js";

describe("reloadServicePlugins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspacePathMock.mockReturnValue("/tmp/workspace");
    mocks.shouldRestartChannelsForPluginReloadMock.mockReturnValue(true);
  });

  it("reloads through the extension host instead of falling back to the main process", async () => {
    const nextPluginRegistry = {
      plugins: [{ id: "nextclaw-runtime-codex" }],
    };
    const nextExtensionRegistry = {
      channels: [{ channel: { id: "weixin" } }],
    };
    const nextPluginChannelBindings = [{ pluginId: "nextclaw-runtime-codex", channelId: "weixin" }];
    mocks.toExtensionRegistryMock.mockReturnValue(nextExtensionRegistry);
    mocks.getPluginChannelBindingsMock.mockReturnValue(nextPluginChannelBindings);

    const extensionHost = {
      load: vi.fn(async () => ({
        plugins: [],
        diagnostics: [],
        tools: [],
        channels: [],
        providers: [],
        ncpAgentRuntimes: [],
      })),
      createProxyPluginRegistry: vi.fn(() => nextPluginRegistry),
      startPluginGateways: vi.fn(async () => undefined),
      stopPluginGateways: vi.fn(async () => undefined),
    };

    const result = await reloadServicePlugins({
      nextConfig: {
        agents: { defaults: { workspace: "/tmp/workspace" } },
      } as never,
      changedPaths: ["plugins.entries.nextclaw-runtime-codex.enabled"],
      extensionRegistry: { channels: [] } as never,
      pluginChannelBindings: [],
      extensionHost: extensionHost as never,
    });

    expect(extensionHost.load).toHaveBeenCalledWith({
      config: { agents: { defaults: { workspace: "/tmp/workspace" } } },
      workspaceDir: "/tmp/workspace",
    });
    expect(extensionHost.createProxyPluginRegistry).toHaveBeenCalledTimes(1);
    expect(extensionHost.stopPluginGateways).toHaveBeenCalledTimes(1);
    expect(extensionHost.startPluginGateways).toHaveBeenCalledWith({
      agents: { defaults: { workspace: "/tmp/workspace" } },
    });
    expect(mocks.loadPluginRegistryMock).not.toHaveBeenCalled();
    expect(mocks.stopPluginChannelGatewaysMock).not.toHaveBeenCalled();
    expect(mocks.startPluginChannelGatewaysMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      pluginRegistry: nextPluginRegistry,
      extensionRegistry: nextExtensionRegistry,
      pluginChannelBindings: nextPluginChannelBindings,
      restartChannels: true,
    });
  });
});

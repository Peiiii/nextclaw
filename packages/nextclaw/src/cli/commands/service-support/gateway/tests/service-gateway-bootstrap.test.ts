import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextclawCoreModule from "@nextclaw/core";
import type * as OpenclawCompatModule from "@nextclaw/openclaw-compat";

const mocks = vi.hoisted(() => ({
  getPluginUiMetadataFromRegistryMock: vi.fn(),
  installPluginRuntimeBridgeMock: vi.fn(),
  loadConfigMock: vi.fn(),
  logPluginGatewayDiagnosticsMock: vi.fn(),
  reloadServicePluginsMock: vi.fn(),
  resolveConfigSecretsMock: vi.fn(),
  startPluginChannelGatewaysMock: vi.fn()
}));

vi.mock("@nextclaw/core", async (importOriginal) => {
  const actual = await importOriginal<typeof NextclawCoreModule>();
  return {
    ...actual,
    loadConfig: mocks.loadConfigMock,
    resolveConfigSecrets: mocks.resolveConfigSecretsMock
  };
});

vi.mock("@nextclaw/openclaw-compat", async (importOriginal) => {
  const actual = await importOriginal<typeof OpenclawCompatModule>();
  return {
    ...actual,
    getPluginUiMetadataFromRegistry: mocks.getPluginUiMetadataFromRegistryMock,
    startPluginChannelGateways: mocks.startPluginChannelGatewaysMock
  };
});

vi.mock("../service-capability-hydration.service.js", () => ({
  hydrateServiceCapabilities: vi.fn()
}));

vi.mock("../../plugin/service-plugin-reload.js", () => ({
  reloadServicePlugins: mocks.reloadServicePluginsMock
}));

vi.mock("../../plugin/service-plugin-runtime-bridge.js", () => ({
  installPluginRuntimeBridge: mocks.installPluginRuntimeBridgeMock
}));

vi.mock("../service-startup-support.js", () => ({
  logPluginGatewayDiagnostics: mocks.logPluginGatewayDiagnosticsMock,
  pluginGatewayLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

import { configureGatewayPluginRuntime } from "../service-gateway-bootstrap.service.js";

describe("configureGatewayPluginRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfigMock.mockReturnValue({});
    mocks.resolveConfigSecretsMock.mockImplementation((config) => config);
  });

  it("syncs gateway capability state before returning a channel restart signal", async () => {
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
    const nextPluginGatewayHandles = [{ pluginId: "nextclaw-channel-weixin", channelId: "weixin", accountId: "bot" }];
    const nextPluginUiMetadata = [{ id: "nextclaw-channel-weixin" }];
    mocks.reloadServicePluginsMock.mockResolvedValue({
      pluginRegistry: nextPluginRegistry,
      extensionRegistry: nextExtensionRegistry,
      pluginChannelBindings: nextPluginChannelBindings,
      pluginGatewayHandles: nextPluginGatewayHandles,
      restartChannels: true
    });
    mocks.getPluginUiMetadataFromRegistryMock.mockReturnValue(nextPluginUiMetadata);

    let reloadPluginsHandler:
      | ((params: { config: unknown; changedPaths: string[] }) => Promise<{ restartChannels?: boolean } | void>)
      | undefined;
    const gateway = {
      runtimeConfigPath: "/tmp/config.json",
      pluginRegistry: { plugins: [] },
      extensionRegistry: { channels: [] },
      pluginChannelBindings: [],
      reloader: {
        setApplyAgentRuntimeConfig: vi.fn(),
        setReloadPlugins: vi.fn((callback) => {
          reloadPluginsHandler = callback;
        }),
        setReloadMcp: vi.fn()
      }
    };
    const state = {
      pluginRegistry: { plugins: [] },
      extensionRegistry: { channels: [] },
      pluginChannelBindings: [],
      pluginUiMetadata: [],
      pluginGatewayHandles: []
    };
    const uiNcpAgent = {
      applyExtensionRegistry: vi.fn()
    };

    configureGatewayPluginRuntime({
      gateway: gateway as never,
      state: state as never,
      getLiveUiNcpAgent: () => uiNcpAgent as never
    });

    expect(mocks.installPluginRuntimeBridgeMock).toHaveBeenCalledTimes(1);
    expect(reloadPluginsHandler).toBeTypeOf("function");

    const result = await reloadPluginsHandler?.({
      config: { channels: { weixin: { enabled: true } } },
      changedPaths: ["plugins.entries.nextclaw-channel-weixin.enabled"]
    });

    expect(result).toEqual({ restartChannels: true });
    expect(gateway.pluginRegistry).toBe(nextPluginRegistry);
    expect(gateway.extensionRegistry).toBe(nextExtensionRegistry);
    expect(gateway.pluginChannelBindings).toBe(nextPluginChannelBindings);
    expect(state.pluginRegistry).toBe(nextPluginRegistry);
    expect(state.extensionRegistry).toBe(nextExtensionRegistry);
    expect(state.pluginChannelBindings).toBe(nextPluginChannelBindings);
    expect(state.pluginUiMetadata).toBe(nextPluginUiMetadata);
    expect(state.pluginGatewayHandles).toBe(nextPluginGatewayHandles);
    expect(uiNcpAgent.applyExtensionRegistry).toHaveBeenCalledWith(nextExtensionRegistry);
  });
});

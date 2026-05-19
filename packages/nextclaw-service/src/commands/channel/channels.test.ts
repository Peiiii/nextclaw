import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "@nextclaw/core";

const mocks = vi.hoisted(() => ({
  loadConfigMock: vi.fn<() => Config>(),
  saveConfigMock: vi.fn<(config: Config) => void>(),
  getWorkspacePathMock: vi.fn<(workspace?: string) => string>(),
  getPluginChannelBindingsMock: vi.fn(),
  buildPluginStatusReportMock: vi.fn(),
  loadPluginRegistryMock: vi.fn(),
  discoverExtensionManifestsMock: vi.fn(),
  resolveExtensionManifestRootsMock: vi.fn(),
  resolveChannelConfigViewMock: vi.fn(),
}));

vi.mock("@nextclaw/core", () => ({
  getWorkspacePath: mocks.getWorkspacePathMock,
  loadConfig: mocks.loadConfigMock,
  saveConfig: mocks.saveConfigMock,
}));

vi.mock("@nextclaw/runtime", () => ({
  BUILTIN_CHANNEL_PLUGIN_IDS: [
    "telegram",
    "whatsapp",
    "discord",
    "feishu",
    "mochat",
    "dingtalk",
    "wecom",
    "email",
    "slack",
    "qq",
    "weixin"
  ],
  builtinProviderIds: () => []
}));

vi.mock("@nextclaw/openclaw-compat", () => ({
  buildPluginStatusReport: mocks.buildPluginStatusReportMock,
  enablePluginInConfig: vi.fn((config: Config) => config),
  getPluginChannelBindings: mocks.getPluginChannelBindingsMock,
}));

vi.mock("../plugin/index.js", () => ({
  loadPluginRegistry: mocks.loadPluginRegistryMock,
  mergePluginConfigView: vi.fn(),
  toPluginConfigView: vi.fn()
}));

vi.mock("../channel/channel-config-view.js", () => ({
  resolveChannelConfigView: mocks.resolveChannelConfigViewMock,
}));

vi.mock("../../shared/services/extensions/extension-lifecycle.service.js", () => ({
  ExtensionManifestDiscoveryService: class {
    discoverSync = mocks.discoverExtensionManifestsMock;
  },
}));

vi.mock("../../shared/services/extensions/service-extension-runtime.service.js", () => ({
  resolveExtensionManifestRoots: mocks.resolveExtensionManifestRootsMock,
}));

import { ChannelCommands } from "./index.js";

describe("ChannelCommands.status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfigMock.mockReturnValue({
      agents: {
        defaults: {
          workspace: "~/.nextclaw/workspace"
        }
      }
    } as Config);
    mocks.getWorkspacePathMock.mockReturnValue("/tmp/workspace");
    mocks.loadPluginRegistryMock.mockReturnValue({ channels: [] });
    mocks.discoverExtensionManifestsMock.mockReturnValue([]);
    mocks.resolveExtensionManifestRootsMock.mockReturnValue([]);
    mocks.getPluginChannelBindingsMock.mockReturnValue([]);
    mocks.buildPluginStatusReportMock.mockReturnValue({ plugins: [] });
    mocks.resolveChannelConfigViewMock.mockReturnValue({
      channels: {
        telegram: { enabled: false },
        whatsapp: { enabled: false },
        discord: { enabled: false },
        feishu: { enabled: false },
        mochat: { enabled: false },
        dingtalk: { enabled: false },
        wecom: { enabled: false },
        email: { enabled: false },
        slack: { enabled: false },
        qq: { enabled: false },
        weixin: { enabled: false }
      }
    });
  });

  it("prints weixin alongside the other builtin channels", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = new ChannelCommands({
      logo: "nextclaw",
      getBridgeDir: () => "/tmp/bridge",
      requestRestart: vi.fn(async () => undefined)
    });

    commands.status();

    expect(logSpy.mock.calls.flat()).toContain("Weixin: ✗");
    logSpy.mockRestore();
  });

  it("lists NextClaw extension manifest channels without starting extension processes", () => {
    mocks.getPluginChannelBindingsMock.mockReturnValue([]);
    mocks.discoverExtensionManifestsMock.mockReturnValue([
      {
        id: "nextclaw-channel-extension-weixin",
        rootDir: "/tmp/weixin",
        server: { type: "stdio", command: "node" },
        contributes: {
          channels: [{
            id: "weixin",
            name: "Weixin",
            auth: { type: "request-response" },
            outbound: { text: true },
          }],
        },
      },
    ]);
    mocks.resolveChannelConfigViewMock.mockReturnValue({
      channels: {
        weixin: { enabled: true, defaultAccountId: "bot-1@im.bot" },
      },
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = new ChannelCommands({
      logo: "nextclaw",
      getBridgeDir: () => "/tmp/bridge",
      requestRestart: vi.fn(async () => undefined)
    });

    commands.list({ json: true });

    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toEqual({
      channels: [{
        id: "weixin",
        label: "Weixin",
        pluginId: "nextclaw-channel-extension-weixin",
        enabled: true,
        outbound: { text: true },
        auth: { login: true },
        defaultAccountId: "bot-1@im.bot",
      }],
    });
    logSpy.mockRestore();
  });

  it("prints plugin channels as structured JSON for agent channel discovery", () => {
    mocks.getPluginChannelBindingsMock.mockReturnValue([
      {
        pluginId: "nextclaw-channel-extension-weixin",
        channelId: "weixin",
        channel: {
          id: "weixin",
          meta: { label: "Weixin" },
          outbound: { sendText: vi.fn() },
          auth: { login: vi.fn() },
        },
      },
      {
        pluginId: "nextclaw-channel-extension-feishu",
        channelId: "feishu",
        channel: {
          id: "feishu",
          meta: { label: "Feishu" },
          outbound: { sendText: vi.fn() },
        },
      },
    ]);
    mocks.resolveChannelConfigViewMock.mockReturnValue({
      channels: {
        weixin: { enabled: true, defaultAccountId: "bot-1@im.bot" },
        feishu: { enabled: false },
      },
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = new ChannelCommands({
      logo: "nextclaw",
      getBridgeDir: () => "/tmp/bridge",
      requestRestart: vi.fn(async () => undefined)
    });

    commands.list({ json: true });

    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toEqual({
      channels: [
        {
          id: "feishu",
          label: "Feishu",
          pluginId: "nextclaw-channel-extension-feishu",
          enabled: false,
          outbound: { text: true },
          auth: { login: false },
        },
        {
          id: "weixin",
          label: "Weixin",
          pluginId: "nextclaw-channel-extension-weixin",
          enabled: true,
          outbound: { text: true },
          auth: { login: true },
          defaultAccountId: "bot-1@im.bot",
        },
      ],
    });
    logSpy.mockRestore();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "@nextclaw/core";

const mocks = vi.hoisted(() => ({
  loadConfigMock: vi.fn<() => Config>(),
  saveConfigMock: vi.fn<(config: Config) => void>(),
  getWorkspacePathMock: vi.fn<(workspace?: string) => string>(),
  getPluginChannelBindingsMock: vi.fn(),
  buildPluginStatusReportMock: vi.fn(),
  loadPluginRegistryMock: vi.fn(),
  resolveChannelConfigViewMock: vi.fn()
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

vi.mock("./plugins.js", () => ({
  loadPluginRegistry: mocks.loadPluginRegistryMock,
  mergePluginConfigView: vi.fn(),
  toPluginConfigView: vi.fn()
}));

vi.mock("./channel-config-view.js", () => ({
  resolveChannelConfigView: mocks.resolveChannelConfigViewMock,
}));

import { ChannelCommands } from "./channels.js";

describe("ChannelCommands.channelsStatus", () => {
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

    commands.channelsStatus();

    expect(logSpy.mock.calls.flat()).toContain("Weixin: ✗");
  });
});

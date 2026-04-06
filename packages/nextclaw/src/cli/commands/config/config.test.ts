import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "@nextclaw/core";

const mocks = vi.hoisted(() => ({
  loadConfigMock: vi.fn<() => Config>(),
  saveConfigMock: vi.fn<(config: Config) => void>(),
  getWorkspacePathMock: vi.fn<(workspace?: string) => string>(),
  diffConfigPathsMock: vi.fn<(prev: Config, next: Config) => string[]>(),
  buildReloadPlanMock: vi.fn<(paths: string[]) => { restartRequired: string[] }>(),
  getPluginChannelBindingsMock: vi.fn(),
  loadPluginRegistryMock: vi.fn(),
  mergePluginConfigViewMock: vi.fn(),
  resolveChannelConfigViewMock: vi.fn()
}));

vi.mock("@nextclaw/core", () => ({
  buildReloadPlan: mocks.buildReloadPlanMock,
  diffConfigPaths: mocks.diffConfigPathsMock,
  getWorkspacePath: mocks.getWorkspacePathMock,
  loadConfig: mocks.loadConfigMock,
  saveConfig: mocks.saveConfigMock,
}));

vi.mock("@nextclaw/openclaw-compat", () => ({
  getPluginChannelBindings: mocks.getPluginChannelBindingsMock,
}));

vi.mock("../plugins.js", () => ({
  loadPluginRegistry: mocks.loadPluginRegistryMock,
  mergePluginConfigView: mocks.mergePluginConfigViewMock,
}));

vi.mock("../channel/channel-config-view.js", () => ({
  resolveChannelConfigView: mocks.resolveChannelConfigViewMock,
}));

import { ConfigCommands } from "../config.js";

const BASE_CONFIG = {
  agents: {
    defaults: {
      workspace: "~/workspace"
    }
  },
  channels: {},
  plugins: {
    entries: {}
  }
} as unknown as Config;

const PROJECTED_VIEW = {
  ...BASE_CONFIG,
  channels: {
    weixin: {
      enabled: true,
      baseUrl: "https://old.example"
    }
  }
} as unknown as Config;

describe("ConfigCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfigMock.mockReturnValue(BASE_CONFIG);
    mocks.getWorkspacePathMock.mockReturnValue("/tmp/workspace");
    mocks.loadPluginRegistryMock.mockReturnValue({ channels: [] });
    mocks.getPluginChannelBindingsMock.mockReturnValue([
      {
        pluginId: "nextclaw-channel-weixin",
        channelId: "weixin",
        channel: { id: "weixin" }
      }
    ]);
    mocks.resolveChannelConfigViewMock.mockReturnValue(PROJECTED_VIEW);
    mocks.mergePluginConfigViewMock.mockImplementation((_baseConfig, nextView) => ({
      ...BASE_CONFIG,
      channels: {
        weixin: (nextView as { channels: { weixin: Record<string, unknown> } }).channels.weixin
      },
      plugins: {
        entries: {
          "nextclaw-channel-weixin": {
            enabled: true
          }
        }
      }
    }));
    mocks.diffConfigPathsMock.mockReturnValue(["channels.weixin.baseUrl"]);
    mocks.buildReloadPlanMock.mockReturnValue({ restartRequired: ["channels"] });
  });

  it("reads plugin-bound channel paths from the projected channels view", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = new ConfigCommands({
      requestRestart: vi.fn(async () => undefined)
    });

    commands.configGet("channels.weixin.baseUrl");

    expect(mocks.resolveChannelConfigViewMock).toHaveBeenCalledWith(
      BASE_CONFIG,
      mocks.getPluginChannelBindingsMock.mock.results[0]?.value
    );
    expect(logSpy).toHaveBeenCalledWith("https://old.example");
  });

  it("writes plugin-bound channel paths back through the projected channels merge bridge", async () => {
    const requestRestart = vi.fn(async () => undefined);
    const commands = new ConfigCommands({ requestRestart });

    await commands.configSet("channels.weixin.baseUrl", "\"https://new.example\"", { json: true });

    expect(mocks.mergePluginConfigViewMock).toHaveBeenCalledTimes(1);
    expect(mocks.mergePluginConfigViewMock.mock.calls[0]?.[1]).toMatchObject({
      channels: {
        weixin: {
          enabled: true,
          baseUrl: "https://new.example"
        }
      }
    });
    expect(mocks.saveConfigMock).toHaveBeenCalledWith({
      ...BASE_CONFIG,
      channels: {
        weixin: {
          enabled: true,
          baseUrl: "https://new.example"
        }
      },
      plugins: {
        entries: {
          "nextclaw-channel-weixin": {
            enabled: true
          }
        }
      }
    });
    expect(requestRestart).toHaveBeenCalledTimes(1);
  });

  it("rejects sparse array writes without saving invalid config", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const commands = new ConfigCommands({
      requestRestart: vi.fn(async () => undefined)
    });

    await expect(commands.configSet("agents.list[3].id", "\"researcher\"", { json: true }))
      .rejects.toThrow("process.exit");

    expect(errorSpy).toHaveBeenCalledWith(
      'Error: Cannot set sparse array index 3 under "agents.list". Set indices in order.'
    );
    expect(mocks.saveConfigMock).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

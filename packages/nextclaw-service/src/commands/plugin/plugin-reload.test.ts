import { describe, expect, it } from "vitest";
import { shouldRestartChannelsForPluginReload } from "./plugin-reload.js";

describe("shouldRestartChannelsForPluginReload", () => {
  it("skips channel restart for runtime-only plugin changes", () => {
    expect(
      shouldRestartChannelsForPluginReload({
        changedPaths: ["plugins.entries.nextclaw-ncp-runtime-plugin-codex-sdk.enabled"],
        currentPluginChannelBindings: [],
        nextPluginChannelBindings: [],
        currentExtensionChannels: [],
        nextExtensionChannels: [],
      }),
    ).toBe(false);
  });

  it("restarts channels when a channel-bound plugin config changes", () => {
    expect(
      shouldRestartChannelsForPluginReload({
        changedPaths: ["plugins.entries.builtin-channel-discord.config.token"],
        currentPluginChannelBindings: [{
          pluginId: "builtin-channel-discord",
          channelId: "discord",
          channel: { id: "discord" },
        }],
        nextPluginChannelBindings: [{
          pluginId: "builtin-channel-discord",
          channelId: "discord",
          channel: { id: "discord" },
        }],
        currentExtensionChannels: [
          {
            extensionId: "builtin-channel-discord",
            channel: { id: "discord" },
            source: "plugin",
          },
        ],
        nextExtensionChannels: [
          {
            extensionId: "builtin-channel-discord",
            channel: { id: "discord" },
            source: "plugin",
          },
        ],
      }),
    ).toBe(true);
  });

  it("restarts channels when a projected plugin channel config changes under channels.*", () => {
    expect(
      shouldRestartChannelsForPluginReload({
        changedPaths: ["channels.feishu.enabled"],
        currentPluginChannelBindings: [{
          pluginId: "builtin-channel-feishu",
          channelId: "feishu",
          channel: { id: "feishu" },
        }],
        nextPluginChannelBindings: [{
          pluginId: "builtin-channel-feishu",
          channelId: "feishu",
          channel: { id: "feishu" },
        }],
        currentExtensionChannels: [
          {
            extensionId: "builtin-channel-feishu",
            channel: { id: "feishu" },
            source: "plugin",
          },
        ],
        nextExtensionChannels: [
          {
            extensionId: "builtin-channel-feishu",
            channel: { id: "feishu" },
            source: "plugin",
          },
        ],
      }),
    ).toBe(true);
  });
});

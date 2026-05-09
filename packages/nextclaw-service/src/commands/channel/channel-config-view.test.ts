import { describe, expect, it } from "vitest";
import { ConfigSchema, type Config } from "@nextclaw/core";
import type { PluginChannelBinding } from "@nextclaw/openclaw-compat";
import { resolveChannelConfigView } from "./channel-config-view.js";

function createDiscordBinding(): PluginChannelBinding {
  return {
    pluginId: "builtin-channel-discord",
    channelId: "discord",
    channel: { id: "discord" }
  };
}

describe("resolveChannelConfigView", () => {
  it("falls back to builtin channel plugin config when top-level channel config is default", () => {
    const config = ConfigSchema.parse({
      plugins: {
        entries: {
          "builtin-channel-discord": {
            enabled: true,
            config: {
              enabled: true,
              token: "plugin-token",
              accountId: "default"
            }
          }
        }
      }
    }) as unknown as Config;

    const view = resolveChannelConfigView(config, [createDiscordBinding()]);

    expect(view.channels.discord.token).toBe("plugin-token");
    expect(view.channels.discord.enabled).toBe(true);
  });

  it("prefers explicit top-level channel config over stale builtin plugin config", () => {
    const config = {
      channels: {
        discord: {
          enabled: true,
          token: "raw-token"
        }
      },
      plugins: {
        entries: {
          "builtin-channel-discord": {
            enabled: true,
            config: {
              enabled: true,
              token: "plugin-token"
            }
          }
        }
      }
    } as unknown as Config;

    const view = resolveChannelConfigView(config, [createDiscordBinding()]);

    expect(view.channels.discord.enabled).toBe(true);
    expect(view.channels.discord.token).toBe("raw-token");
  });

  it("keeps channel disabled when builtin plugin entry is disabled", () => {
    const config = ConfigSchema.parse({
      plugins: {
        entries: {
          "builtin-channel-discord": {
            enabled: false,
            config: {
              enabled: true,
              token: "plugin-token"
            }
          }
        }
      }
    }) as unknown as Config;

    const view = resolveChannelConfigView(config, [createDiscordBinding()]);

    expect(view.channels.discord.enabled).toBe(false);
    expect(view.channels.discord.token).toBe("plugin-token");
  });
});

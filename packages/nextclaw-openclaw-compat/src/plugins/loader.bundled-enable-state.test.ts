import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import { loadOpenClawPlugins } from "./loader.js";

type PluginRegistry = ReturnType<typeof loadOpenClawPlugins>;

function buildConfig(input: Record<string, unknown> = {}) {
  return ConfigSchema.parse(input);
}

function readDiscordPlugin(registry: PluginRegistry) {
  return registry.plugins.find((plugin) => plugin.id === "builtin-channel-discord");
}

describe("loadOpenClawPlugins bundled channel enable state", () => {
  const originalEnableExternal = process.env.NEXTCLAW_ENABLE_OPENCLAW_PLUGINS;

  beforeEach(() => {
    process.env.NEXTCLAW_ENABLE_OPENCLAW_PLUGINS = "0";
  });

  afterEach(() => {
    if (typeof originalEnableExternal === "string") {
      process.env.NEXTCLAW_ENABLE_OPENCLAW_PLUGINS = originalEnableExternal;
      return;
    }
    delete process.env.NEXTCLAW_ENABLE_OPENCLAW_PLUGINS;
  });

  it("respects plugins.entries.*.enabled=false for bundled discord plugin", () => {
    const config = buildConfig({
      plugins: {
        entries: {
          "builtin-channel-discord": {
            enabled: false
          }
        }
      }
    });

    const registry = loadOpenClawPlugins({ config, mode: "validate" });
    const plugin = readDiscordPlugin(registry);

    expect(plugin).toBeDefined();
    expect(plugin?.enabled).toBe(false);
    expect(plugin?.status).toBe("disabled");
    expect(plugin?.error).toBe("disabled in config");
    expect(registry.channels.some((channel) => channel.pluginId === "builtin-channel-discord")).toBe(false);
  });

  it("respects allowlist/denylist rules for bundled plugins", () => {
    const deniedConfig = buildConfig({
      plugins: {
        deny: ["builtin-channel-discord"]
      }
    });
    const deniedRegistry = loadOpenClawPlugins({ config: deniedConfig, mode: "validate" });
    const deniedPlugin = readDiscordPlugin(deniedRegistry);

    expect(deniedPlugin).toBeDefined();
    expect(deniedPlugin?.enabled).toBe(false);
    expect(deniedPlugin?.status).toBe("disabled");
    expect(deniedPlugin?.error).toBe("blocked by denylist");

    const allowlistConfig = buildConfig({
      plugins: {
        allow: ["builtin-channel-slack"]
      }
    });
    const allowlistRegistry = loadOpenClawPlugins({ config: allowlistConfig, mode: "validate" });
    const allowlistPlugin = readDiscordPlugin(allowlistRegistry);

    expect(allowlistPlugin).toBeDefined();
    expect(allowlistPlugin?.enabled).toBe(false);
    expect(allowlistPlugin?.status).toBe("disabled");
    expect(allowlistPlugin?.error).toBe("not in allowlist");
  });

  it("can be re-enabled and re-register bundled discord plugin", () => {
    const config = buildConfig({
      plugins: {
        entries: {
          "builtin-channel-discord": {
            enabled: true
          }
        }
      }
    });

    const registry = loadOpenClawPlugins({ config, mode: "validate" });
    const plugin = readDiscordPlugin(registry);

    expect(plugin).toBeDefined();
    expect(plugin?.enabled).toBe(true);
    expect(plugin?.status).toBe("loaded");
    expect(registry.channels.some((channel) => channel.pluginId === "builtin-channel-discord")).toBe(true);
  });
});

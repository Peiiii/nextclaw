import { mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import { removePluginFromConfig, uninstallPlugin } from "./uninstall.js";

const tempDirs: string[] = [];

const createTempPluginDir = (pluginId: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-plugin-uninstall-"));
  tempDirs.push(dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "openclaw.plugin.json"),
    JSON.stringify({
      id: pluginId,
      configSchema: {
        type: "object",
        properties: {},
      },
    }),
  );
  return dir;
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("removePluginFromConfig", () => {
  it("removes matching plugin load paths even without a path install record", () => {
    const pluginDir = createTempPluginDir("community-slack-connector");
    const config = ConfigSchema.parse({
      plugins: {
        load: {
          paths: [pluginDir],
        },
        entries: {
          "community-slack-connector": {
            enabled: true,
          },
        },
      },
    });

    const result = removePluginFromConfig(config, "community-slack-connector");

    expect(result.actions.entry).toBe(true);
    expect(result.actions.loadPath).toBe(true);
    expect(result.config.plugins.load).toBeUndefined();
  });
});

describe("uninstallPlugin", () => {
  it("removes managed plugin copies from both global and workspace extension directories", async () => {
    const homeDir = mkdtempSync(join(tmpdir(), "nextclaw-plugin-home-"));
    const workspaceDir = mkdtempSync(join(tmpdir(), "nextclaw-plugin-workspace-"));
    tempDirs.push(homeDir, workspaceDir);

    const pluginId = "community-slack-connector";
    const globalExtensionsDir = join(homeDir, "extensions");
    const workspaceExtensionsDir = join(workspaceDir, ".nextclaw", "extensions");
    const globalPluginDir = join(globalExtensionsDir, pluginId);
    const workspacePluginDir = join(workspaceExtensionsDir, pluginId);
    mkdirSync(globalPluginDir, { recursive: true });
    mkdirSync(workspacePluginDir, { recursive: true });

    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: workspaceDir,
        },
      },
      plugins: {
        entries: {
          [pluginId]: {
            enabled: true,
          },
        },
        installs: {
          [pluginId]: {
            source: "npm",
            spec: "@community/slack-channel",
            installPath: globalPluginDir,
          },
        },
      },
    });

    const result = await uninstallPlugin({
      config,
      pluginId,
      extensionsDir: globalExtensionsDir,
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.actions.directory).toBe(true);
    expect(result.ok && result.config.plugins.entries).toBeUndefined();
    expect(result.ok && result.config.plugins.installs).toBeUndefined();
    expect(() => statSync(globalPluginDir)).toThrow();
    expect(() => statSync(workspacePluginDir)).toThrow();
  });
});

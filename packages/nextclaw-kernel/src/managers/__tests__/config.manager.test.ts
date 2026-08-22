import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config, ExtensionRegistry } from "@nextclaw/core";
import { ConfigManager } from "@kernel/managers/config.manager.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-kernel-config-manager-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("ConfigManager", () => {
  it("merges runtime hooks installed by kernel and host", async () => {
    const channels = {
      load: vi.fn(),
      reload: vi.fn(async () => undefined),
    };
    const manager = new ConfigManager({
      configPath: join(createTempDir(), "config.json"),
      channels: channels as never,
      providerManager: {
        load: vi.fn(),
      } as never,
    });
    const extensionChannels: ExtensionRegistry["channels"] = [{
      extensionId: "extension-test",
      channel: { id: "test" },
      source: "extension-manifest",
    }];

    manager.installRuntimeHooks({
      resolveChannelConfig: (config) => ({
        ...config,
        channels: {
          ...config.channels,
          test: { enabled: true },
        } as Config["channels"],
      }),
    });
    manager.installRuntimeHooks({
      getExtensionChannels: () => extensionChannels,
    });

    await manager.rebuildChannels(manager.config, { start: false });

    expect(channels.reload).toHaveBeenCalledWith({
      channelConfig: expect.objectContaining({
        channels: expect.objectContaining({
          test: { enabled: true },
        }),
      }),
      extensionChannels,
      start: false,
    });
  });

  it("restores the previous runtime hook when an installed hook is disposed", async () => {
    const channels = {
      load: vi.fn(),
      reload: vi.fn(async () => undefined),
    };
    const manager = new ConfigManager({
      configPath: join(createTempDir(), "config.json"),
      channels: channels as never,
      providerManager: { load: vi.fn() } as never,
    });
    manager.installRuntimeHooks({
      resolveChannelConfig: (config) => ({
        ...config,
        channels: { original: { enabled: true } } as Config["channels"],
      }),
    });
    const dispose = manager.installRuntimeHooks({
      resolveChannelConfig: (config) => ({
        ...config,
        channels: { temporary: { enabled: true } } as Config["channels"],
      }),
    });

    dispose();
    await manager.rebuildChannels(manager.config, { start: false });

    expect(channels.reload).toHaveBeenCalledWith(
      expect.objectContaining({
        channelConfig: expect.objectContaining({
          channels: { original: { enabled: true } },
        }),
      }),
    );
  });

  it("reconciles extension demand before rebuilding channels on channel config changes", async () => {
    const callOrder: string[] = [];
    const channels = {
      load: vi.fn(),
      reload: vi.fn(async () => {
        callOrder.push("channels");
      }),
    };
    const manager = new ConfigManager({
      configPath: join(createTempDir(), "config.json"),
      channels: channels as never,
      providerManager: {
        load: vi.fn(),
      } as never,
    });
    const reloadExtensions = vi.fn(async () => {
      callOrder.push("extensions");
    });
    manager.installRuntimeHooks({ reloadExtensions });
    const nextConfig: Config = {
      ...manager.config,
      channels: {
        ...manager.config.channels,
        weixin: {
          ...manager.config.channels.weixin,
          enabled: true,
        },
      },
    };

    await manager.applyReloadPlan(nextConfig);

    expect(reloadExtensions).toHaveBeenCalledWith({
      config: nextConfig,
      changedPaths: ["channels.weixin.enabled"],
    });
    expect(callOrder).toEqual(["extensions", "channels"]);
  });
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config, ExtensionRegistry } from "@nextclaw/core";
import { ConfigManager } from "./config.manager.js";

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
});

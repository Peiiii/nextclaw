import { LocalConfigStore } from "@kernel/stores/local-config.store.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, type Config, type ExtensionRegistry } from "@nextclaw/core";
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
  it("does not replace malformed stored JSON with a default config", async () => {
    const save = vi.fn();
    const manager = new ConfigManager({
      storage: { location: "memory:invalid", load: () => ConfigSchema.parse({}), readRaw: () => "{broken", save },
      channels: { load: vi.fn(), reload: vi.fn() } as never,
      providerManager: { load: vi.fn() } as never,
    });
    await expect(manager.patchRawConfig({ baseHash: "invalid", raw: "{}" }))
      .resolves.toMatchObject({ ok: false, error: expect.stringContaining("hash unavailable") });
    expect(save).not.toHaveBeenCalled();
  });

  it("checks competing patch hashes after the preceding asynchronous commit", async () => {
    let config = ConfigSchema.parse({});
    let commit!: () => void;
    let entered!: () => void;
    const saving = new Promise<void>((resolve) => { entered = resolve; });
    const barrier = new Promise<void>((resolve) => { commit = resolve; });
    const save = vi.fn(async (next: Config) => {
      entered();
      await barrier;
      config = structuredClone(next);
    });
    const manager = new ConfigManager({
      storage: { location: "memory:concurrent", load: () => config, readRaw: () => JSON.stringify(config), save },
      channels: { load: vi.fn(), reload: vi.fn() } as never,
      providerManager: { load: vi.fn() } as never,
    });
    vi.spyOn(manager, "applyReloadPlan").mockResolvedValue(undefined);
    const baseHash = manager.getConfigSnapshot().hash as string;
    const first = manager.patchRawConfig({ baseHash, raw: JSON.stringify({ agents: { defaults: { model: "test/first" } } }) });
    await saving;
    const second = manager.patchRawConfig({ baseHash, raw: JSON.stringify({ agents: { defaults: { model: "test/second" } } }) });
    expect(save).toHaveBeenCalledTimes(1);
    commit();
    await expect(first).resolves.toMatchObject({ ok: true });
    await expect(second).resolves.toMatchObject({ ok: false, error: expect.stringContaining("config changed") });
    expect(config.agents.defaults.model).toBe("test/first");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("waits for platform persistence and does not apply a failed save", async () => {
    const original = ConfigSchema.parse({});
    let rejectSave!: (error: Error) => void;
    const saved = new Promise<void>((_resolve, reject) => { rejectSave = reject; });
    const manager = new ConfigManager({
      storage: {
        location: "memory:test",
        load: () => original,
        readRaw: () => JSON.stringify(original),
        save: () => saved,
      },
      channels: { load: vi.fn(), reload: vi.fn() } as never,
      providerManager: { load: vi.fn() } as never,
    });
    const apply = vi.spyOn(manager, "applyReloadPlan");
    const next = structuredClone(original);
    next.agents.defaults.model = "test/new-model";
    const mutation = manager.applyConfig(next);
    const failure = expect(mutation).rejects.toThrow("storage unavailable");
    await Promise.resolve();
    expect(apply).not.toHaveBeenCalled();
    rejectSave(new Error("storage unavailable"));
    await failure;
    expect(apply).not.toHaveBeenCalled();
    expect(manager.config.agents.defaults.model).toBe(original.agents.defaults.model);
  });

  it("merges runtime hooks installed by kernel and host", async () => {
    const channels = {
      load: vi.fn(),
      reload: vi.fn(async () => undefined),
    };
    const manager = new ConfigManager({
      storage: new LocalConfigStore(join(createTempDir(), "config.json")),
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
      storage: new LocalConfigStore(join(createTempDir(), "config.json")),
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
      storage: new LocalConfigStore(join(createTempDir(), "config.json")),
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

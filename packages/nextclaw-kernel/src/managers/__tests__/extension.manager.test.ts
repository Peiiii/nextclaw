import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginChannelBinding, PluginRegistry } from "@nextclaw/openclaw-compat";
import type * as OpenClawCompatModule from "@nextclaw/openclaw-compat";
import { ExtensionManager } from "@kernel/managers/extension.manager.js";

const mocks = vi.hoisted(() => ({
  discoverPluginStatusReportMock: vi.fn(),
  getPluginChannelBindingsMock: vi.fn(),
  getPluginUiMetadataFromRegistryMock: vi.fn(),
  loadOpenClawPluginsProgressivelyMock: vi.fn(),
}));

vi.mock("@nextclaw/runtime", () => ({
  builtinProviderIds: () => [],
}));

vi.mock("@nextclaw/openclaw-compat", async (importOriginal) => {
  const actual = await importOriginal<typeof OpenClawCompatModule>();
  return {
    ...actual,
    discoverPluginStatusReport: mocks.discoverPluginStatusReportMock,
    getPluginChannelBindings: mocks.getPluginChannelBindingsMock,
    getPluginUiMetadataFromRegistry: mocks.getPluginUiMetadataFromRegistryMock,
    loadOpenClawPluginsProgressively: mocks.loadOpenClawPluginsProgressivelyMock,
  };
});

const tempDirs: string[] = [];
const originalDisableBuiltinExtensions = process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS;
const originalDevFirstPartyPluginDir = process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR;

const createRegistry = (partial: Partial<PluginRegistry> = {}): PluginRegistry => ({
  plugins: [],
  tools: [],
  channels: [],
  providers: [],
  diagnostics: [],
  resolvedTools: [],
  ...partial,
});

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-kernel-extension-manager-test-"));
  tempDirs.push(dir);
  return dir;
}

function createConfig(extensionRoot?: string) {
  return {
    agents: { defaults: { workspace: createTempDir() } },
    plugins: {
      load: {
        paths: extensionRoot ? [extensionRoot] : [],
      },
    },
  };
}

function createManager(config: Record<string, unknown>) {
  return new ExtensionManager({
    configManager: {
      loadConfig: () => config as never,
    },
    eventBus: {
      emitEnvelope: vi.fn(),
    },
    ingress: {
      addHandler: vi.fn(),
    },
    messageBus: {
      publishInbound: vi.fn(),
    },
  });
}

async function loadRegistryThroughManager(registry: PluginRegistry) {
  const manager = createManager(createConfig());
  mocks.discoverPluginStatusReportMock.mockReturnValue({
    plugins: registry.plugins.map(() => ({ enabled: true })),
  });
  mocks.loadOpenClawPluginsProgressivelyMock.mockResolvedValue(registry);
  const result = await manager.load({
    config: createConfig() as never,
  });
  return { manager, result };
}

describe("ExtensionManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS = "1";
    process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR = createTempDir();
    mocks.discoverPluginStatusReportMock.mockReturnValue({ plugins: [] });
    mocks.getPluginChannelBindingsMock.mockReturnValue([]);
    mocks.getPluginUiMetadataFromRegistryMock.mockReturnValue([]);
    mocks.loadOpenClawPluginsProgressivelyMock.mockResolvedValue(createRegistry());
  });

  afterEach(() => {
    if (originalDisableBuiltinExtensions === undefined) {
      delete process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS;
    } else {
      process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS = originalDisableBuiltinExtensions;
    }
    if (originalDevFirstPartyPluginDir === undefined) {
      delete process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR;
    } else {
      process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR = originalDevFirstPartyPluginDir;
    }
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("derives extension registry from plugin registry", async () => {
    const registry = createRegistry({
      channels: [{
        pluginId: "nextclaw-channel-test",
        channel: { id: "test" },
        source: "plugin",
      }],
      diagnostics: [{
        level: "warn",
        message: "slow plugin",
        pluginId: "nextclaw-channel-test",
        source: "plugin",
      }],
    });

    const { manager } = await loadRegistryThroughManager(registry);

    expect(manager.getExtensionRegistry()).toMatchObject({
      channels: [{
        extensionId: "nextclaw-channel-test",
        channel: { id: "test" },
        source: "plugin",
      }],
      diagnostics: [{
        extensionId: "nextclaw-channel-test",
        level: "warn",
        message: "slow plugin",
        source: "plugin",
      }],
    });
  });

  it("lets extension manifest contributions override registry channel facts", async () => {
    const extensionRoot = createTempDir();
    const extensionDir = join(extensionRoot, "extension-weixin");
    mkdirSync(extensionDir);
    writeFileSync(join(extensionDir, "nextclaw.extension.json"), JSON.stringify({
      id: "extension-weixin",
      server: {
        type: "stdio",
        command: "node",
      },
      contributes: {
        channels: [{
          id: "weixin",
          name: "Weixin",
        }],
      },
    }));
    const registry = createRegistry({
      channels: [{
        pluginId: "legacy-weixin",
        channel: { id: "weixin" },
        source: "plugin",
      }],
    });
    const extensionBinding = {
      pluginId: "extension-weixin",
      channelId: "weixin",
      channel: { id: "weixin" },
    } as PluginChannelBinding;
    const manager = createManager(createConfig(extensionRoot));
    mocks.discoverPluginStatusReportMock.mockReturnValue({ plugins: [{ enabled: true }] });
    mocks.loadOpenClawPluginsProgressivelyMock.mockResolvedValue(registry);
    mocks.getPluginChannelBindingsMock.mockReturnValue([extensionBinding]);

    const result = await manager.load({
      config: createConfig(extensionRoot) as never,
    });

    expect(manager.getChannelBindings()).toEqual([
      expect.objectContaining({
        pluginId: "extension-weixin",
        channelId: "weixin",
      }),
    ]);
    expect(manager.getExtensionRegistry().channels).toEqual([
      expect.objectContaining({
        extensionId: "extension-weixin",
        channel: expect.objectContaining({ id: "weixin" }),
        source: "extension-manifest",
      }),
    ]);
    expect(result.totalPluginCount).toBe(1);
  });
});

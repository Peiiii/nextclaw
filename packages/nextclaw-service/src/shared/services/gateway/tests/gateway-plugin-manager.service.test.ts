import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextclawCoreModule from "@nextclaw/core";
import type * as OpenclawCompatModule from "@nextclaw/openclaw-compat";

const mocks = vi.hoisted(() => ({
  discoverPluginStatusReportMock: vi.fn(),
  getPluginChannelBindingsMock: vi.fn(),
  getPluginUiMetadataFromRegistryMock: vi.fn(),
  getWorkspacePathMock: vi.fn(),
  loadOpenClawPluginsProgressivelyMock: vi.fn(),
  logPluginDiagnosticsMock: vi.fn(),
  logPluginGatewayDiagnosticsMock: vi.fn(),
  toPluginConfigViewMock: vi.fn(),
}));

vi.mock("@nextclaw/core", async (importOriginal) => {
  const actual = await importOriginal<typeof NextclawCoreModule>();
  return {
    ...actual,
    getWorkspacePath: mocks.getWorkspacePathMock,
  };
});

vi.mock("@nextclaw/openclaw-compat", async (importOriginal) => {
  const actual = await importOriginal<typeof OpenclawCompatModule>();
  return {
    ...actual,
    discoverPluginStatusReport: mocks.discoverPluginStatusReportMock,
    getPluginChannelBindings: mocks.getPluginChannelBindingsMock,
    getPluginUiMetadataFromRegistry: mocks.getPluginUiMetadataFromRegistryMock,
    loadOpenClawPluginsProgressively: mocks.loadOpenClawPluginsProgressivelyMock,
    toPluginConfigView: mocks.toPluginConfigViewMock,
  };
});

vi.mock("@nextclaw-service/commands/plugin/index.js", () => ({
  logPluginDiagnostics: mocks.logPluginDiagnosticsMock,
}));

vi.mock("../service-startup-support.service.js", () => ({
  logPluginGatewayDiagnostics: mocks.logPluginGatewayDiagnosticsMock,
  pluginGatewayLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GatewayPluginManager } from "../managers/gateway-plugin.manager.js";
import { ExtensionManager } from "@nextclaw/kernel";
import type { NextclawGatewayRuntime } from "../nextclaw-gateway-runtime.service.js";

const tempDirs: string[] = [];
const originalDisableBuiltinExtensions = process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS;
const originalDevFirstPartyExtensionDir = process.env.NEXTCLAW_DEV_FIRST_PARTY_EXTENSION_DIR;
const sessionManager = {} as never;

const createRegistry = (partial: Record<string, unknown> = {}) => ({
  plugins: [],
  tools: [],
  channels: [],
  providers: [],
  diagnostics: [],
  resolvedTools: [],
  ...partial,
});

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-gateway-plugin-test-"));
  tempDirs.push(dir);
  return dir;
}

const createGateway = (config: Record<string, unknown> = {
  agents: { defaults: { workspace: "~/.nextclaw/workspace" } },
  plugins: { load: { paths: [] } },
}): NextclawGatewayRuntime => {
  const extensions = new ExtensionManager({
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
    sessionManager,
  });
  return {
    appEventBus: {
      emit: vi.fn(),
      emitEnvelope: vi.fn(),
    },
    bootstrapStatus: {
      markChannelsPending: vi.fn(),
      markPluginHydrationError: vi.fn(),
      markPluginHydrationProgress: vi.fn(),
      markPluginHydrationReady: vi.fn(),
      markPluginHydrationRunning: vi.fn(),
    },
    kernel: {
      extensions,
    },
    configManager: {
      loadConfig: () => config,
      rebuildChannels: vi.fn(async () => undefined),
    },
  } as never;
};

describe("GatewayPluginManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS = "1";
    process.env.NEXTCLAW_DEV_FIRST_PARTY_EXTENSION_DIR = createTempDir();
    mocks.getWorkspacePathMock.mockReturnValue("/tmp/workspace");
    mocks.discoverPluginStatusReportMock.mockReturnValue({ plugins: [{ enabled: true }] });
    mocks.getPluginChannelBindingsMock.mockReturnValue([]);
    mocks.getPluginUiMetadataFromRegistryMock.mockReturnValue([]);
    mocks.loadOpenClawPluginsProgressivelyMock.mockResolvedValue(createRegistry());
    mocks.toPluginConfigViewMock.mockImplementation((config) => config);
  });

  afterEach(() => {
    if (originalDisableBuiltinExtensions === undefined) {
      delete process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS;
    } else {
      process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS = originalDisableBuiltinExtensions;
    }
    if (originalDevFirstPartyExtensionDir === undefined) {
      delete process.env.NEXTCLAW_DEV_FIRST_PARTY_EXTENSION_DIR;
    } else {
      process.env.NEXTCLAW_DEV_FIRST_PARTY_EXTENSION_DIR = originalDevFirstPartyExtensionDir;
    }
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("owns plugin registry derived state during load", async () => {
    const gateway = createGateway();
    const manager = new GatewayPluginManager(gateway);
    const registry = createRegistry({
      plugins: [{ id: "nextclaw-channel-test" }],
      channels: [{
        pluginId: "nextclaw-channel-test",
        channel: { id: "test" },
        source: "plugin",
      }],
    });
    const extensionRegistry = {
      tools: [],
      channels: [{
        extensionId: "nextclaw-channel-test",
        channel: { id: "test" },
        source: "plugin",
      }],
      diagnostics: [],
    };
    const channelBindings = [
      {
        pluginId: "nextclaw-channel-test",
        channelId: "test",
        channel: { id: "test" },
      },
    ];
    mocks.loadOpenClawPluginsProgressivelyMock.mockResolvedValue(registry);
    mocks.getPluginChannelBindingsMock.mockReturnValue(channelBindings);

    await manager.load();

    expect(gateway.configManager.rebuildChannels).toHaveBeenCalledTimes(1);
    expect(mocks.logPluginDiagnosticsMock).toHaveBeenCalledWith({
      diagnostics: registry.diagnostics,
    });
    expect(gateway.kernel.extensions.getExtensionRegistry()).toEqual(extensionRegistry);
    expect(gateway.kernel.extensions.getChannelBindings()).toEqual(expect.arrayContaining(channelBindings));
  });

  it("merges extension manifest contributions without direct extension package imports", async () => {
    const extensionRoot = createTempDir();
    const extensionDir = join(extensionRoot, "nextclaw-channel-extension-weixin");
    mkdirSync(extensionDir);
    writeFileSync(join(extensionDir, "nextclaw.extension.json"), JSON.stringify({
      id: "nextclaw-channel-extension-weixin",
      server: {
        type: "stdio",
        command: "node",
      },
      contributes: {
        channels: [{
          id: "weixin",
          name: "Weixin",
          configSchema: { type: "object" },
        }],
      },
    }));
    const gateway = createGateway({
      agents: { defaults: { workspace: "~/.nextclaw/workspace" } },
      plugins: { load: { paths: [extensionRoot] } },
    });
    const manager = new GatewayPluginManager(gateway);
    const legacyWeixinBinding = {
      pluginId: "community-channel-plugin-weixin",
      channelId: "weixin",
      channel: { id: "weixin" },
    };
    mocks.loadOpenClawPluginsProgressivelyMock.mockResolvedValue(createRegistry({
      channels: [{
        pluginId: "community-channel-plugin-weixin",
        channel: { id: "weixin" },
        source: "plugin",
      }],
    }));
    mocks.getPluginChannelBindingsMock.mockReturnValue([legacyWeixinBinding]);

    await manager.load();

    expect(gateway.kernel.extensions.getChannelBindings()).toEqual([
      expect.objectContaining({
        pluginId: "nextclaw-channel-extension-weixin",
        channelId: "weixin",
      }),
    ]);
    expect(gateway.kernel.extensions.getExtensionRegistry().channels).toEqual([
      expect.objectContaining({
        extensionId: "nextclaw-channel-extension-weixin",
        channel: expect.objectContaining({ id: "weixin" }),
        source: "extension-manifest",
      }),
    ]);
  });

  it("owns plugin gateway handles", async () => {
    const gateway = createGateway({
      agents: { defaults: { workspace: "~/.nextclaw/workspace" } },
      plugins: { load: { paths: [] } },
      channels: {
        test: { enabled: true },
      },
    });
    const manager = new GatewayPluginManager(gateway);
    const stop = vi.fn(async () => undefined);
    const startAccount = vi.fn(async () => ({ stop }));
    const binding = {
      pluginId: "nextclaw-channel-test",
      channelId: "test",
      channel: {
        id: "test",
        gateway: {
          startAccount,
        },
        config: {
          listAccountIds: () => ["bot"],
        },
      },
    };
    mocks.loadOpenClawPluginsProgressivelyMock.mockResolvedValue(createRegistry({
      plugins: [{ id: "nextclaw-channel-test" }],
    }));
    mocks.getPluginChannelBindingsMock.mockReturnValue([binding]);
    mocks.toPluginConfigViewMock.mockReturnValue({
      channels: {
        test: { enabled: true },
      },
    });
    await manager.load();

    await manager.startGateways();
    await manager.stopGateways();

    expect(startAccount).toHaveBeenCalledWith(expect.objectContaining({
      accountId: "bot",
      channelId: "test",
    }));
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

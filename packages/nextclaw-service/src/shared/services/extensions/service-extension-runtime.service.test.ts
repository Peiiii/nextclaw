import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ingress } from "@nextclaw/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveBuiltinExtensionManifestRoots,
  resolveExtensionManifestRoots,
  ServiceExtensionRuntime,
  startDiscoveredExtensions,
} from "./service-extension-runtime.service.js";
import {
  ExtensionManifestDiscoveryService,
  type ExtensionLifecycleService,
  type ExtensionManifest,
} from "./extension-lifecycle.service.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-service-extension-startup-test-"));
  tempDirs.push(dir);
  return dir;
}

function createGateway(params: {
  workspace: string;
  extensionRoot: string;
}) {
  return {
    appEventBus: {
      emitEnvelope: vi.fn(),
    },
    configManager: {
      loadConfig: () => ({
        channels: {
          weixin: {
            enabled: true,
          },
        },
        plugins: {
          load: {
            paths: [params.extensionRoot],
          },
        },
      }),
    },
    messageBus: {
      publishInbound: vi.fn(async () => undefined),
    },
    uiStartup: {
      endpoint: "http://127.0.0.1:55667",
    },
    workspace: params.workspace,
  };
}

function writeExtensionManifest(root: string): string {
  const extensionDir = join(root, "fake-extension");
  mkdirSync(extensionDir);
  writeFileSync(join(extensionDir, "nextclaw.extension.json"), JSON.stringify({
    id: "fake-extension",
    name: "Fake Extension",
    server: {
      type: "stdio",
      command: "node",
      args: ["dist/index.js"],
    },
    contributes: {
      channels: [{
        id: "fake-channel",
        name: "Fake Channel",
        description: "Fake channel",
        auth: true,
        outbound: {
          text: true,
        },
        configSchema: { type: "object" },
        configUiHints: {
          enabled: { label: "Enabled" },
        },
      }],
    },
  }));
  return extensionDir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("resolveExtensionManifestRoots", () => {
  it("includes bundled extension packages so production service installs can discover them", () => {
    const roots = resolveBuiltinExtensionManifestRoots();

    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-weixin"))).toBe(true);
  });

  it("skips bundled extension packages when the host disables duplicate child processes", () => {
    const original = process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS;
    process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS = "1";

    try {
      expect(resolveBuiltinExtensionManifestRoots()).toEqual([]);
    } finally {
      if (original === undefined) {
        delete process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS;
      } else {
        process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS = original;
      }
    }
  });

  it("uses NextClaw extension directories and existing configured load paths", () => {
    const workspace = createTempDir();
    const roots = resolveExtensionManifestRoots({
      workspace,
      config: {
        plugins: {
          load: {
            paths: [workspace],
          },
        },
      } as never,
    });

    expect(roots).toContain(join(workspace, ".nextclaw", "extensions"));
    expect(roots.filter((root) => root === workspace)).toHaveLength(1);
  });
});

describe("startDiscoveredExtensions", () => {
  it("starts discovered manifest processes with the shared ingress token", async () => {
    const root = createTempDir();
    const originalDevExtensionDir = process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR;
    process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR = join(createTempDir(), "missing");
    const extensionDir = join(root, "fake-extension");
    mkdirSync(extensionDir);
    writeFileSync(join(extensionDir, "nextclaw.extension.json"), JSON.stringify({
      id: "fake-extension",
      server: {
        type: "stdio",
        command: "node",
        args: ["dist/index.js"],
      },
    }));
    const lifecycle = {
      startAll: vi.fn(async (manifests: ExtensionManifest[]) =>
      manifests.map((manifest) => ({ manifest, process: {} })),
      ),
    };

    try {
      const result = await startDiscoveredExtensions({
        config: {
          plugins: {
            load: {
              paths: [root],
            },
          },
        } as never,
        workspace: createTempDir(),
        endpoint: "http://127.0.0.1:55667",
        token: "shared-token",
        discovery: new ExtensionManifestDiscoveryService(),
        lifecycle: lifecycle as unknown as ExtensionLifecycleService,
      });

      expect(result.running.map((entry) => entry.manifest)).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: "fake-extension",
          rootDir: extensionDir,
        }),
      ]));
    } finally {
      if (originalDevExtensionDir === undefined) {
        delete process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR;
      } else {
        process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR = originalDevExtensionDir;
      }
    }
  });
});

describe("ServiceExtensionRuntime", () => {
  it("builds channel bindings from manifests and resolves auth through extension request responses", async () => {
    const root = createTempDir();
    writeExtensionManifest(root);
    const gateway = createGateway({
      workspace: createTempDir(),
      extensionRoot: root,
    });
    const runtime = new ServiceExtensionRuntime(gateway as never);
    const ingress = new Ingress();
    runtime.registerIngressHandlers(ingress);

    const contributions = await runtime.loadContributions();
    const binding = contributions.channelBindings.find((entry) => entry.pluginId === "fake-extension");
    const startPromise = binding?.channel.auth?.start?.({
      cfg: {} as never,
      pluginId: binding.pluginId,
      channelId: binding.channelId,
      pluginConfig: { enabled: true },
      accountId: null,
      baseUrl: null,
    });
    const event = (gateway.appEventBus.emitEnvelope as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const requestId = event?.payload?.requestId;

    expect(binding).toEqual(expect.objectContaining({
      pluginId: "fake-extension",
      channelId: "fake-channel",
    }));
    expect(event).toEqual(expect.objectContaining({
      type: "extension.request",
      payload: expect.objectContaining({
        extensionId: "fake-extension",
        kind: "channel.auth.start",
        payload: expect.objectContaining({
          channelId: "fake-channel",
        }),
      }),
    }));

    await ingress.handle({
      type: "extension.response",
      payload: {
        requestId,
        ok: true,
        data: {
          channel: "fake-channel",
          kind: "qr_code",
          sessionId: "session-1",
          qrCode: "qr",
          qrCodeUrl: "https://example.test/qr",
          expiresAt: "2026-05-11T00:00:00.000Z",
          intervalMs: 1000,
        },
      },
    }, {
      source: "test",
      token: runtime.token,
    });

    await expect(startPromise).resolves.toEqual(expect.objectContaining({
      channel: "fake-channel",
      sessionId: "session-1",
    }));

    const sendPromise = binding?.channel.outbound?.sendText?.({
      cfg: {} as never,
      to: "conversation-1",
      text: "hello",
      accountId: "account-1",
    });
    const sendEvent = (gateway.appEventBus.emitEnvelope as ReturnType<typeof vi.fn>).mock.calls[1]?.[0];
    const sendRequestId = sendEvent?.payload?.requestId;

    expect(sendEvent).toEqual(expect.objectContaining({
      type: "extension.request",
      payload: expect.objectContaining({
        extensionId: "fake-extension",
        kind: "channel.outbound.sendText",
        payload: {
          channelId: "fake-channel",
          to: "conversation-1",
          text: "hello",
          accountId: "account-1",
        },
      }),
    }));

    await ingress.handle({
      type: "extension.response",
      payload: {
        requestId: sendRequestId,
        ok: true,
        data: {
          accepted: true,
        },
      },
    }, {
      source: "test",
      token: runtime.token,
    });

    await expect(sendPromise).resolves.toEqual({ accepted: true });
  });
});

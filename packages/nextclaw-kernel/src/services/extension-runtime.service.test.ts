import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ingress } from "@nextclaw/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExtensionManifestDiscoveryService,
  resolveBuiltinExtensionManifestRoots,
  resolveExtensionManifestRoots,
} from "@kernel/features/extension-runtime/index.js";
import {
  ExtensionRuntimeService,
} from "./extension-runtime.service.js";

const tempDirs: string[] = [];

const sessionManager = {} as never;

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-kernel-extension-runtime-test-"));
  tempDirs.push(dir);
  return dir;
}

function writeExtensionManifest(root: string): void {
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
        configSchema: { type: "object" },
        configUiHints: {
          enabled: { label: "Enabled" },
        },
      }],
    },
  }));
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

    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-dingtalk"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-discord"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-email"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-slack"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-telegram"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-wecom"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-whatsapp"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-weixin"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-qq"))).toBe(true);
  });

  it("uses NextClaw extension directories", () => {
    const workspace = createTempDir();
    const roots = resolveExtensionManifestRoots({
      workspace,
      config: {} as never,
    });

    expect(roots).toContain(join(workspace, ".nextclaw", "extensions"));
  });
});

describe("ExtensionRuntimeService", () => {
  it("deduplicates extension manifests by id across discovery roots", async () => {
    const rootA = createTempDir();
    const rootB = createTempDir();
    writeExtensionManifest(rootA);
    writeExtensionManifest(rootB);

    const manifests = await new ExtensionManifestDiscoveryService().discover([rootA, rootB]);

    expect(manifests.map((manifest) => manifest.id)).toEqual(["fake-extension"]);
  });

  it("builds channel bindings from manifests and resolves auth through extension request responses", async () => {
    const workspace = createTempDir();
    const root = join(workspace, ".nextclaw", "extensions");
    mkdirSync(root, { recursive: true });
    writeExtensionManifest(root);
    const eventBus = {
      emitEnvelope: vi.fn(),
    };
    const ingress = new Ingress();
    const runtime = new ExtensionRuntimeService({
      eventBus,
      getConfig: () => ({
        channels: {
          fake: {
            enabled: true,
          },
        },
      }) as never,
      getWorkspace: () => workspace,
      ingress,
      messageBus: {
        publishInbound: vi.fn(async () => undefined),
      },
      sessionManager,
    });
    runtime.registerIngressHandlers();

    const contributions = await runtime.loadChannelContributions({
      config: {
      } as never,
      workspace,
    });
    const binding = contributions.channelBindings.find((entry) => entry.extensionId === "fake-extension");
    const startPromise = binding?.channel.auth?.start?.({
      cfg: {} as never,
      extensionId: binding.extensionId,
      channelId: binding.channelId,
      channelConfig: { enabled: true },
      accountId: null,
      baseUrl: null,
    });
    const event = eventBus.emitEnvelope.mock.calls[0]?.[0];
    const requestId = event?.payload?.requestId;

    expect(binding).toEqual(expect.objectContaining({
      extensionId: "fake-extension",
      channelId: "fake-channel",
      channel: expect.objectContaining({
        outbound: expect.objectContaining({
          sendText: expect.any(Function),
        }),
      }),
    }));
    expect(event).toEqual(expect.objectContaining({
      type: "extension.request",
      payload: expect.objectContaining({
        extensionId: "fake-extension",
        kind: "channel.auth.start",
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

    eventBus.emitEnvelope.mockClear();
    const connectPromise = binding?.channel.auth?.connect?.({
      cfg: {} as never,
      extensionId: binding.extensionId,
      channelId: binding.channelId,
      channelConfig: { enabled: true },
      accountId: null,
      domain: "feishu",
      fields: { appId: "app-id", appSecret: "secret" },
    });
    const connectEvent = eventBus.emitEnvelope.mock.calls[0]?.[0];
    const connectRequestId = connectEvent?.payload?.requestId;
    expect(connectEvent).toEqual(expect.objectContaining({
      type: "extension.request",
      payload: expect.objectContaining({
        extensionId: "fake-extension",
        kind: "channel.auth.connect",
        payload: expect.objectContaining({
          domain: "feishu",
          fields: { appId: "app-id", appSecret: "secret" },
        }),
      }),
    }));

    await ingress.handle({
      type: "extension.response",
      payload: {
        requestId: connectRequestId,
        ok: true,
        data: {
          channel: "fake-channel",
          status: "authorized",
          accountId: "app-id",
        },
      },
    }, {
      source: "test",
      token: runtime.token,
    });

    await expect(connectPromise).resolves.toEqual(expect.objectContaining({
      channel: "fake-channel",
      status: "authorized",
      accountId: "app-id",
    }));
  });

  it("forwards outbound channel reply context to extension requests", async () => {
    const workspace = createTempDir();
    const root = join(workspace, ".nextclaw", "extensions");
    mkdirSync(root, { recursive: true });
    writeExtensionManifest(root);
    const eventBus = {
      emitEnvelope: vi.fn(),
    };
    const ingress = new Ingress();
    const runtime = new ExtensionRuntimeService({
      eventBus,
      getConfig: () => ({
        channels: {
          fake: {
            enabled: true,
          },
        },
      }) as never,
      getWorkspace: () => workspace,
      ingress,
      messageBus: {
        publishInbound: vi.fn(async () => undefined),
      },
      sessionManager,
    });
    runtime.registerIngressHandlers();

    const contributions = await runtime.loadChannelContributions({
      config: {
      } as never,
      workspace,
    });
    const binding = contributions.channelBindings.find((entry) => entry.extensionId === "fake-extension");
    const sendPromise = binding?.channel.outbound?.sendText?.({
      cfg: {} as never,
      to: "chat-1",
      text: "hello",
      accountId: "account-1",
      replyTo: "message-1",
      media: ["asset-1"],
      metadata: {
        qq: {
          messageType: "group",
          groupId: "group-1",
          userId: "user-1",
        },
      },
    });
    const event = eventBus.emitEnvelope.mock.calls[0]?.[0];

    expect(event).toEqual(expect.objectContaining({
      type: "extension.request",
      payload: expect.objectContaining({
        extensionId: "fake-extension",
        kind: "channel.outbound.sendText",
        payload: expect.objectContaining({
          channelId: "fake-channel",
          to: "chat-1",
          text: "hello",
          accountId: "account-1",
          replyTo: "message-1",
          media: ["asset-1"],
          metadata: {
            qq: {
              messageType: "group",
              groupId: "group-1",
              userId: "user-1",
            },
          },
        }),
      }),
    }));

    await ingress.handle({
      type: "extension.response",
      payload: {
        requestId: event?.payload?.requestId,
        ok: true,
        data: { accepted: true },
      },
    }, {
      source: "test",
      token: runtime.token,
    });

    await expect(sendPromise).resolves.toEqual({ accepted: true });
  });
});

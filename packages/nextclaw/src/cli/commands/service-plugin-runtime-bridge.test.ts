import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextclawCoreModule from "@nextclaw/core";

const setPluginRuntimeBridgeMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn(() => ({})));
const resolveConfigSecretsMock = vi.hoisted(() => vi.fn((config) => config));
const saveConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@nextclaw/openclaw-compat", () => ({
  setPluginRuntimeBridge: setPluginRuntimeBridgeMock,
}));

vi.mock("@nextclaw/core", async (importOriginal) => {
  const actual = await importOriginal<typeof NextclawCoreModule>();
  return {
    ...actual,
    loadConfig: loadConfigMock,
    resolveConfigSecrets: resolveConfigSecretsMock,
    saveConfig: saveConfigMock,
  };
});

import { installPluginRuntimeBridge } from "./service-plugin-runtime-bridge.js";

describe("installPluginRuntimeBridge media attachment forwarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps MediaPaths into runtime attachments", async () => {
    const processDirect = vi.fn(async () => "ok");
    installPluginRuntimeBridge({
      runtimePool: { processDirect } as never,
      runtimeConfigPath: "/tmp/config.json",
      pluginChannelBindings: [],
    });

    const bridge = setPluginRuntimeBridgeMock.mock.calls[0]?.[0] as {
      dispatchReplyWithBufferedBlockDispatcher: (params: {
        ctx: Record<string, unknown>;
        dispatcherOptions: { deliver: (payload: unknown, info: unknown) => Promise<void> };
      }) => Promise<void>;
    };

    await bridge.dispatchReplyWithBufferedBlockDispatcher({
      ctx: {
        BodyForAgent: "look at this",
        SessionKey: "agent:main:feishu:direct:oc_chat",
        OriginatingChannel: "feishu",
        OriginatingTo: "oc_chat",
        MediaPath: "/tmp/first.png",
        MediaPaths: ["/tmp/first.png", "/tmp/second.png"],
        MediaType: "image/png",
        MediaTypes: ["image/png", "image/jpeg"],
      },
      dispatcherOptions: {
        deliver: vi.fn(async () => {}),
      },
    });

    expect(processDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            path: "/tmp/first.png",
            mimeType: "image/png",
            status: "ready",
          }),
          expect.objectContaining({
            path: "/tmp/second.png",
            mimeType: "image/jpeg",
            status: "ready",
          }),
        ],
      }),
    );
  });

  it("keeps remote-only media when only MediaUrls are available", async () => {
    const processDirect = vi.fn(async () => "ok");
    installPluginRuntimeBridge({
      runtimePool: { processDirect } as never,
      runtimeConfigPath: "/tmp/config.json",
      pluginChannelBindings: [],
    });

    const bridge = setPluginRuntimeBridgeMock.mock.calls[0]?.[0] as {
      dispatchReplyWithBufferedBlockDispatcher: (params: {
        ctx: Record<string, unknown>;
        dispatcherOptions: { deliver: (payload: unknown, info: unknown) => Promise<void> };
      }) => Promise<void>;
    };

    await bridge.dispatchReplyWithBufferedBlockDispatcher({
      ctx: {
        Body: "describe this image",
        SenderId: "ou_sender",
        MediaUrls: ["https://example.com/a.png"],
        MediaTypes: ["image/png"],
      },
      dispatcherOptions: {
        deliver: vi.fn(async () => {}),
      },
    });

    expect(processDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            url: "https://example.com/a.png",
            mimeType: "image/png",
            status: "remote-only",
          }),
        ],
      }),
    );
  });
});

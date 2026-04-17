import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MessageBus } from "@nextclaw/core";
import {
  loadWeixinCursor,
  saveWeixinAccount,
  saveWeixinCursor,
} from "../weixin-account.store.js";

const sendWeixinTextMessageMock = vi.hoisted(() => vi.fn(async () => ({ messageId: "msg-1" })));
const sendWeixinImageMessageMock = vi.hoisted(() => vi.fn(async () => ({ messageId: "msg-image-1" })));
const sendWeixinFileMessageMock = vi.hoisted(() => vi.fn(async () => ({ messageId: "msg-file-1" })));
const fetchWeixinUpdatesMock = vi.hoisted(() =>
  vi.fn(async () => ({ ret: 0, msgs: [], get_updates_buf: "" })),
);
const typingControllerStartMock = vi.hoisted(() => vi.fn(async () => {}));
const typingControllerStopMock = vi.hoisted(() => vi.fn(async () => {}));
const typingControllerStopAllMock = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("../weixin-api.client.js", () => ({
  sendWeixinTextMessage: sendWeixinTextMessageMock,
  fetchWeixinConfig: vi.fn(async () => ({ ret: 0, errcode: 0, typing_ticket: "ticket-1" })),
  fetchWeixinUpdates: fetchWeixinUpdatesMock,
  sendWeixinTyping: vi.fn(async () => ({ ret: 0, errcode: 0 })),
}));

vi.mock("../media/weixin-media.client.js", () => ({
  sendWeixinImageMessage: sendWeixinImageMessageMock,
  sendWeixinFileMessage: sendWeixinFileMessageMock,
}));

vi.mock("../weixin-typing-controller.js", () => ({
  WeixinTypingController: class {
    start = typingControllerStartMock;
    stop = typingControllerStopMock;
    stopAll = typingControllerStopAllMock;
  },
}));

const { WeixinChannel } = await import("../weixin-channel.js");

const tempHomes: string[] = [];
const originalNextclawHome = process.env.NEXTCLAW_HOME;

function createHome(): string {
  const home = mkdtempSync(join(tmpdir(), "nextclaw-weixin-channel-test-"));
  mkdirSync(home, { recursive: true });
  process.env.NEXTCLAW_HOME = home;
  tempHomes.push(home);
  return home;
}

afterEach(() => {
  if (originalNextclawHome) {
    process.env.NEXTCLAW_HOME = originalNextclawHome;
  } else {
    delete process.env.NEXTCLAW_HOME;
  }
  while (tempHomes.length > 0) {
    const home = tempHomes.pop();
    if (!home) {
      continue;
    }
    rmSync(home, { recursive: true, force: true });
  }
  vi.clearAllMocks();
});

describe("WeixinChannel inbound and text reply lifecycle", () => {
  it("starts typing on inbound messages with context token", async () => {
    createHome();
    saveWeixinAccount({
      accountId: "bot-1@im.bot",
      token: "bot-token",
      baseUrl: "https://ilinkai.weixin.qq.com",
      savedAt: "2026-04-10T00:00:00.000Z",
    });
    const published: unknown[] = [];
    const bus = {
      publishInbound: vi.fn(async (msg) => {
        published.push(msg);
      }),
    } as unknown as MessageBus;
    const channel = new WeixinChannel(
      {
        enabled: true,
        defaultAccountId: "bot-1@im.bot",
      },
      bus,
    );

    await (channel as unknown as { handleInboundWeixinMessage: (account: unknown, message: unknown) => Promise<void> })
      .handleInboundWeixinMessage(
        {
          accountId: "bot-1@im.bot",
          token: "bot-token",
          enabled: true,
          baseUrl: "https://ilinkai.weixin.qq.com",
          pollTimeoutMs: 35_000,
          allowFrom: [],
        },
        {
          from_user_id: "user-1@im.wechat",
          context_token: "ctx-1",
          item_list: [{ text_item: { text: "hello" } }],
        },
      );

    expect(typingControllerStartMock).toHaveBeenCalledWith({
      accountId: "bot-1@im.bot",
      userId: "user-1@im.wechat",
      contextToken: "ctx-1",
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
    });
    expect(published).toHaveLength(1);
  });

  it("stops typing after successful send", async () => {
    createHome();
    saveWeixinAccount({
      accountId: "bot-1@im.bot",
      token: "bot-token",
      baseUrl: "https://ilinkai.weixin.qq.com",
      savedAt: "2026-04-10T00:00:00.000Z",
    });
    const bus = {
      publishInbound: vi.fn(async () => {}),
    } as unknown as MessageBus;
    const channel = new WeixinChannel(
      {
        enabled: true,
        defaultAccountId: "bot-1@im.bot",
      },
      bus,
    );

    await channel.send({
      channel: "weixin",
      chatId: "user-1@im.wechat",
      content: "reply",
      media: [],
      metadata: {
        accountId: "bot-1@im.bot",
      },
    });

    expect(sendWeixinTextMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        toUserId: "user-1@im.wechat",
        text: "reply",
      }),
    );
    expect(typingControllerStopMock).toHaveBeenCalledWith({
      accountId: "bot-1@im.bot",
      userId: "user-1@im.wechat",
    });
  });

  it("consumes reply streams text-part by text-part without duplicating the final message", async () => {
    createHome();
    saveWeixinAccount({
      accountId: "bot-1@im.bot",
      token: "bot-token",
      baseUrl: "https://ilinkai.weixin.qq.com",
      savedAt: "2026-04-10T00:00:00.000Z",
    });
    const bus = {
      publishInbound: vi.fn(async () => {}),
    } as unknown as MessageBus;
    const channel = new WeixinChannel(
      {
        enabled: true,
        defaultAccountId: "bot-1@im.bot",
      },
      bus,
    );

    await channel.consumeNcpReply({
      target: {
        conversationId: "user-1@im.wechat",
        accountId: "bot-1@im.bot",
        metadata: {
          accountId: "bot-1@im.bot",
          context_token: "ctx-1",
        },
      },
      eventStream: {
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: "message.text-start",
            payload: {
              sessionId: "session-1",
              messageId: "assistant-1",
            },
          };
          yield {
            type: "message.text-delta",
            payload: {
              sessionId: "session-1",
              messageId: "assistant-1",
              delta: "Hello ",
            },
          };
          yield {
            type: "message.text-end",
            payload: {
              sessionId: "session-1",
              messageId: "assistant-1",
            },
          };
          yield {
            type: "message.text-start",
            payload: {
              sessionId: "session-1",
              messageId: "assistant-1",
            },
          };
          yield {
            type: "message.text-delta",
            payload: {
              sessionId: "session-1",
              messageId: "assistant-1",
              delta: "world",
            },
          };
          yield {
            type: "message.text-end",
            payload: {
              sessionId: "session-1",
              messageId: "assistant-1",
            },
          };
          yield {
            type: "message.completed",
            payload: {
              sessionId: "session-1",
              message: {
                id: "assistant-1",
                sessionId: "session-1",
                role: "assistant",
                status: "final",
                timestamp: new Date().toISOString(),
                parts: [{ type: "text", text: "Hello world" }],
              },
            },
          };
        },
      },
    });

    expect(typingControllerStartMock).toHaveBeenCalledWith({
      accountId: "bot-1@im.bot",
      userId: "user-1@im.wechat",
      contextToken: "ctx-1",
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
    });
    expect(sendWeixinTextMessageMock).toHaveBeenCalledTimes(2);
    expect(sendWeixinTextMessageMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        toUserId: "user-1@im.wechat",
        text: "Hello ",
      }),
    );
    expect(sendWeixinTextMessageMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        toUserId: "user-1@im.wechat",
        text: "world",
      }),
    );
    expect(typingControllerStopMock).toHaveBeenCalledWith({
      accountId: "bot-1@im.bot",
      userId: "user-1@im.wechat",
    });
  });

});

describe("WeixinChannel native media delivery", () => {
  it("sends assistant image file parts through the native weixin image path", async () => {
    createHome();
    saveWeixinAccount({
      accountId: "bot-1@im.bot",
      token: "bot-token",
      baseUrl: "https://ilinkai.weixin.qq.com",
      savedAt: "2026-04-10T00:00:00.000Z",
    });
    const bus = {
      publishInbound: vi.fn(async () => {}),
    } as unknown as MessageBus;
    const channel = new WeixinChannel(
      {
        enabled: true,
        defaultAccountId: "bot-1@im.bot",
      },
      bus,
    );

    await channel.consumeNcpReply({
      target: {
        conversationId: "user-1@im.wechat",
        accountId: "bot-1@im.bot",
        metadata: {
          accountId: "bot-1@im.bot",
          context_token: "ctx-image",
        },
      },
      eventStream: {
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: "message.completed",
            payload: {
              sessionId: "session-1",
              message: {
                id: "assistant-1",
                sessionId: "session-1",
                role: "assistant",
                status: "final",
                timestamp: new Date().toISOString(),
                parts: [
                  {
                    type: "file",
                    name: "diagram.png",
                    mimeType: "image/png",
                    contentBase64: Buffer.from("png-binary").toString("base64"),
                  },
                ],
              },
            },
          };
        },
      },
    });

    expect(sendWeixinImageMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        toUserId: "user-1@im.wechat",
        contextToken: "ctx-image",
        bytes: expect.any(Uint8Array),
      }),
    );
    expect(sendWeixinFileMessageMock).not.toHaveBeenCalled();
    expect(sendWeixinTextMessageMock).not.toHaveBeenCalled();
  });

  it("resolves assetUri file parts and sends them through the native weixin file path", async () => {
    const home = createHome();
    saveWeixinAccount({
      accountId: "bot-1@im.bot",
      token: "bot-token",
      baseUrl: "https://ilinkai.weixin.qq.com",
      savedAt: "2026-04-10T00:00:00.000Z",
    });
    const assetPath = join(home, "report.pdf");
    const pdfBytes = Buffer.from("%PDF-1.7 nextclaw");
    mkdirSync(home, { recursive: true });
    await writeFile(assetPath, pdfBytes);
    const bus = {
      publishInbound: vi.fn(async () => {}),
    } as unknown as MessageBus;
    const channel = new WeixinChannel(
      {
        enabled: true,
        defaultAccountId: "bot-1@im.bot",
      },
      bus,
    );

    await channel.consumeNcpReply({
      target: {
        conversationId: "user-1@im.wechat",
        accountId: "bot-1@im.bot",
        resolveAssetContentPath: (assetUri) =>
          assetUri === "asset://report" ? assetPath : null,
        metadata: {
          accountId: "bot-1@im.bot",
          context_token: "ctx-file",
        },
      },
      eventStream: {
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: "message.completed",
            payload: {
              sessionId: "session-1",
              message: {
                id: "assistant-1",
                sessionId: "session-1",
                role: "assistant",
                status: "final",
                timestamp: new Date().toISOString(),
                parts: [
                  {
                    type: "file",
                    assetUri: "asset://report",
                    mimeType: "application/pdf",
                    name: "report.pdf",
                  },
                ],
              },
            },
          };
        },
      },
    });

    expect(sendWeixinFileMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        toUserId: "user-1@im.wechat",
        contextToken: "ctx-file",
        fileName: "report.pdf",
        bytes: expect.any(Uint8Array),
      }),
    );
    expect(sendWeixinImageMessageMock).not.toHaveBeenCalled();
  });
});

describe("WeixinChannel polling recovery", () => {
  it("clears the saved cursor when getupdates reports session timeout and resumes quietly", async () => {
    createHome();
    saveWeixinAccount({
      accountId: "bot-1@im.bot",
      token: "bot-token",
      baseUrl: "https://ilinkai.weixin.qq.com",
      savedAt: "2026-04-10T00:00:00.000Z",
    });
    saveWeixinCursor("bot-1@im.bot", "stale-cursor");

    const controller = new AbortController();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    fetchWeixinUpdatesMock
      .mockRejectedValueOnce(
        new Error("weixin getupdates failed: errcode=-14, errmsg=session timeout"),
      )
      .mockImplementationOnce(async () => {
        controller.abort();
        return {
          ret: 0,
          msgs: [],
          get_updates_buf: "fresh-cursor",
        };
      });

    const channel = new WeixinChannel(
      {
        enabled: true,
        defaultAccountId: "bot-1@im.bot",
      },
      {
        publishInbound: vi.fn(async () => {}),
      } as unknown as MessageBus,
    );

    (channel as unknown as { running: boolean }).running = true;

    await (channel as unknown as {
      runAccountPollingLoop: (accountId: string, signal: AbortSignal) => Promise<void>;
    }).runAccountPollingLoop("bot-1@im.bot", controller.signal);

    expect(loadWeixinCursor("bot-1@im.bot")).toBe("fresh-cursor");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

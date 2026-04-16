import { createCipheriv } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageBus, type InboundMessage } from "@nextclaw/core";
import type { WeixinMessage } from "../weixin-api.client.js";

vi.mock("../weixin-typing-controller.js", () => ({
  WeixinTypingController: class {
    start = vi.fn(async () => {});
    stop = vi.fn(async () => {});
    stopAll = vi.fn(async () => {});
  },
}));

import { WeixinChannel } from "../weixin-channel.js";

type WeixinRuntimeAccount = {
  accountId: string;
  token: string;
  enabled: boolean;
  baseUrl: string;
  pollTimeoutMs: number;
  allowFrom: string[];
};

const originalFetch = global.fetch;

function encryptAesEcb(buffer: Buffer, key: Buffer): Buffer {
  const cipher = createCipheriv("aes-128-ecb", key, null);
  return Buffer.concat([cipher.update(buffer), cipher.final()]);
}

function createAccount(): WeixinRuntimeAccount {
  return {
    accountId: "bot-1@im.bot",
    token: "bot-token",
    enabled: true,
    baseUrl: "https://ilinkai.weixin.qq.com",
    pollTimeoutMs: 35_000,
    allowFrom: [],
  };
}

async function dispatchInboundMessage(message: WeixinMessage): Promise<InboundMessage | null> {
  const bus = new MessageBus();
  const channel = new WeixinChannel({}, bus);
  await (channel as unknown as {
    handleInboundWeixinMessage: (account: WeixinRuntimeAccount, message: WeixinMessage) => Promise<void>;
  }).handleInboundWeixinMessage(createAccount(), message);
  return bus.inboundSize > 0 ? await bus.consumeInbound() : null;
}

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

describe("WeixinChannel inbound attachments", () => {
  it("publishes attachment-only image messages with a ready image attachment", async () => {
    const imageBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("nextclaw-weixin-image"),
    ]);
    const key = Buffer.from("0123456789abcdef");
    const encryptedBuffer = encryptAesEcb(imageBuffer, key);
    global.fetch = vi.fn(async () =>
      new Response(encryptedBuffer, {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    ) as typeof fetch;

    const message = await dispatchInboundMessage({
      from_user_id: "user-1@im.wechat",
      context_token: "ctx-image",
      item_list: [
        {
          type: 2,
          image_item: {
            media: {
              full_url: "https://cdn.example.com/image.bin",
            },
            aeskey: key.toString("hex"),
          },
        },
      ],
    });

    expect(message).not.toBeNull();
    expect(message?.content).toBe("");
    expect(message?.attachments).toHaveLength(1);
    expect(message?.attachments[0]?.status).toBe("ready");
    expect(message?.attachments[0]?.mimeType).toBe("image/png");
    expect(message?.attachments[0]?.path).toContain("nextclaw-media");
  });

  it("publishes file messages with file metadata and ready attachment path", async () => {
    const fileBuffer = Buffer.from("%PDF-1.7 nextclaw");
    const key = Buffer.from("fedcba9876543210");
    const encryptedBuffer = encryptAesEcb(fileBuffer, key);
    global.fetch = vi.fn(async () =>
      new Response(encryptedBuffer, {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    ) as typeof fetch;

    const message = await dispatchInboundMessage({
      from_user_id: "user-2@im.wechat",
      context_token: "ctx-file",
      item_list: [
        {
          type: 4,
          file_item: {
            file_name: "report.pdf",
            media: {
              full_url: "https://cdn.example.com/report.bin",
              aes_key: Buffer.from(key.toString("hex"), "utf-8").toString("base64"),
            },
          },
        },
      ],
    });

    expect(message).not.toBeNull();
    expect(message?.attachments).toHaveLength(1);
    expect(message?.attachments[0]?.status).toBe("ready");
    expect(message?.attachments[0]?.name).toBe("report.pdf");
    expect(message?.attachments[0]?.mimeType).toBe("application/pdf");
    expect(message?.attachments[0]?.path).toMatch(/\.pdf$/);
  });

  it("detects markdown files as text/markdown instead of generic binary", async () => {
    global.fetch = vi.fn(async () =>
      new Response(Buffer.from("# nextclaw\n"), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    ) as typeof fetch;

    const message = await dispatchInboundMessage({
      from_user_id: "user-4@im.wechat",
      context_token: "ctx-markdown",
      item_list: [
        {
          type: 4,
          file_item: {
            file_name: "notes.md",
            media: {
              full_url: "https://cdn.example.com/notes.bin",
            },
          },
        },
      ],
    });

    expect(message).not.toBeNull();
    expect(message?.attachments).toHaveLength(1);
    expect(message?.attachments[0]?.status).toBe("ready");
    expect(message?.attachments[0]?.name).toBe("notes.md");
    expect(message?.attachments[0]?.mimeType).toBe("text/markdown");
    expect(message?.attachments[0]?.path).toMatch(/\.md$/);
  });

  it("keeps a remote-only attachment instead of dropping the message when download fails", async () => {
    global.fetch = vi.fn(async () =>
      new Response("denied", {
        status: 502,
        statusText: "Bad Gateway",
      }),
    ) as typeof fetch;

    const message = await dispatchInboundMessage({
      from_user_id: "user-3@im.wechat",
      item_list: [
        {
          type: 2,
          image_item: {
            media: {
              full_url: "https://cdn.example.com/unavailable-image.bin",
            },
          },
        },
      ],
    });

    expect(message).not.toBeNull();
    expect(message?.content).toBe("");
    expect(message?.attachments).toHaveLength(1);
    expect(message?.attachments[0]).toMatchObject({
      status: "remote-only",
      errorCode: "download_failed",
      url: "https://cdn.example.com/unavailable-image.bin",
      source: "weixin",
    });
  });
});

import { createCipheriv } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveWeixinInboundAttachments } from "../utils/weixin-inbound-media.utils.js";

const originalFetch = globalThis.fetch;

function encryptAesEcb(buffer: Buffer, key: Buffer): Buffer {
  const cipher = createCipheriv("aes-128-ecb", key, null);
  return Buffer.concat([cipher.update(buffer), cipher.final()]);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("resolveWeixinInboundAttachments", () => {
  it("downloads attachment-only image messages into ready image attachments", async () => {
    const imageBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("nextclaw-weixin-image"),
    ]);
    const key = Buffer.from("0123456789abcdef");
    const encryptedBuffer = encryptAesEcb(imageBuffer, key);
    globalThis.fetch = vi.fn(async () =>
      new Response(encryptedBuffer, {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    ) as typeof fetch;

    const attachments = await resolveWeixinInboundAttachments({
      baseUrl: "https://ilinkai.weixin.qq.com",
      message: {
        item_list: [{
          type: 2,
          image_item: {
            media: {
              full_url: "https://cdn.example.com/image.bin",
            },
            aeskey: key.toString("hex"),
          },
        }],
      },
    });

    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      mimeType: "image/png",
      source: "weixin",
      status: "ready",
      url: "https://cdn.example.com/image.bin",
    });
    expect(attachments[0]?.path).toContain("nextclaw-media");
  });

  it("preserves file metadata and detects markdown files", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(Buffer.from("# nextclaw\n"), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    ) as typeof fetch;

    const attachments = await resolveWeixinInboundAttachments({
      baseUrl: "https://ilinkai.weixin.qq.com",
      message: {
        item_list: [{
          type: 4,
          file_item: {
            file_name: "notes.md",
            media: {
              full_url: "https://cdn.example.com/notes.bin",
            },
          },
        }],
      },
    });

    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      name: "notes.md",
      mimeType: "text/markdown",
      source: "weixin",
      status: "ready",
      url: "https://cdn.example.com/notes.bin",
    });
    expect(attachments[0]?.path).toMatch(/\.md$/);
  });

  it("keeps a remote-only attachment instead of dropping the message when download fails", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("denied", {
        status: 502,
        statusText: "Bad Gateway",
      }),
    ) as typeof fetch;

    const attachments = await resolveWeixinInboundAttachments({
      baseUrl: "https://ilinkai.weixin.qq.com",
      message: {
        item_list: [{
          type: 2,
          image_item: {
            media: {
              full_url: "https://cdn.example.com/unavailable-image.bin",
            },
          },
        }],
      },
    });

    expect(attachments).toEqual([
      expect.objectContaining({
        status: "remote-only",
        errorCode: "download_failed",
        url: "https://cdn.example.com/unavailable-image.bin",
        source: "weixin",
      }),
    ]);
  });
});

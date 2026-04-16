import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchWeixinConfig,
  sendWeixinTyping,
} from "../weixin-api.client.js";
import {
  sendWeixinFileMessage,
  sendWeixinImageMessage,
} from "../media/weixin-media.client.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("weixin api typing helpers", () => {
  it("posts getconfig with context token, base info, and anti-replay headers", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ret: 0, errcode: 0, typing_ticket: "ticket-1" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    await fetchWeixinConfig({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
      ilinkUserId: "user-1@im.wechat",
      contextToken: "ctx-1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://ilinkai.weixin.qq.com/ilink/bot/getconfig");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer bot-token",
      AuthorizationType: "ilink_bot_token",
    });
    const uin = Buffer.from((init?.headers as Record<string, string>)["X-WECHAT-UIN"], "base64").toString("utf8");
    expect(/^\d+$/.test(uin)).toBe(true);
    expect(JSON.parse(String(init?.body))).toEqual({
      ilink_user_id: "user-1@im.wechat",
      context_token: "ctx-1",
      base_info: {
        channel_version: "nextclaw-weixin/0.1.0",
      },
    });
  });

  it("posts sendtyping with explicit status", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ret: 0, errcode: 0 }), { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    await sendWeixinTyping({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
      toUserId: "user-1@im.wechat",
      typingTicket: "ticket-1",
      status: 2,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      ilink_user_id: "user-1@im.wechat",
      typing_ticket: "ticket-1",
      status: 2,
      base_info: {
        channel_version: "nextclaw-weixin/0.1.0",
      },
    });
  });

  it("uploads image bytes and sends a native image message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            upload_param: "upload-param-1",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: {
            "x-encrypted-param": "download-param-1",
          },
        }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    await sendWeixinImageMessage({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
      toUserId: "user-1@im.wechat",
      bytes: new Uint8Array([1, 2, 3, 4]),
      contextToken: "ctx-image",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [uploadUrl, uploadInit] = fetchMock.mock.calls[0] ?? [];
    expect(uploadUrl).toBe("https://ilinkai.weixin.qq.com/ilink/bot/getuploadurl");
    expect(JSON.parse(String(uploadInit?.body))).toMatchObject({
      to_user_id: "user-1@im.wechat",
      media_type: 1,
      rawsize: 4,
      no_need_thumb: true,
    });

    const [cdnUrl, cdnInit] = fetchMock.mock.calls[1] ?? [];
    expect(String(cdnUrl)).toContain("/upload?encrypted_query_param=upload-param-1&filekey=");
    expect(cdnInit?.method).toBe("POST");
    expect(cdnInit?.headers).toMatchObject({
      "Content-Type": "application/octet-stream",
    });

    const [sendUrl, sendInit] = fetchMock.mock.calls[2] ?? [];
    expect(sendUrl).toBe("https://ilinkai.weixin.qq.com/ilink/bot/sendmessage");
    expect(JSON.parse(String(sendInit?.body))).toMatchObject({
      msg: {
        to_user_id: "user-1@im.wechat",
        context_token: "ctx-image",
        item_list: [
          {
            type: 2,
            image_item: {
              media: {
                encrypt_query_param: "download-param-1",
                encrypt_type: 1,
              },
              mid_size: 16,
            },
          },
        ],
      },
    });
  });

  it("uploads file bytes and sends a native file message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            upload_full_url: "https://cdn.example.com/upload/direct",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: {
            "x-encrypted-param": "download-param-file",
          },
        }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    await sendWeixinFileMessage({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
      toUserId: "user-1@im.wechat",
      fileName: "report.pdf",
      bytes: new Uint8Array([9, 8, 7]),
      contextToken: "ctx-file",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, uploadInit] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(uploadInit?.body))).toMatchObject({
      to_user_id: "user-1@im.wechat",
      media_type: 3,
      rawsize: 3,
    });

    const [cdnUrl] = fetchMock.mock.calls[1] ?? [];
    expect(cdnUrl).toBe("https://cdn.example.com/upload/direct");

    const [, sendInit] = fetchMock.mock.calls[2] ?? [];
    expect(JSON.parse(String(sendInit?.body))).toMatchObject({
      msg: {
        to_user_id: "user-1@im.wechat",
        context_token: "ctx-file",
        item_list: [
          {
            type: 4,
            file_item: {
              file_name: "report.pdf",
              len: "3",
              media: {
                encrypt_query_param: "download-param-file",
                encrypt_type: 1,
              },
            },
          },
        ],
      },
    });
  });
});

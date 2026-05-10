import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpWeixinApiClient } from "../weixin-api.service.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("HttpWeixinApiClient", () => {
  it("posts getconfig with context token and stable channel version", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ret: 0, errcode: 0, typing_ticket: "ticket-1" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as typeof fetch;
    const api = new HttpWeixinApiClient();

    await api.fetchConfig({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
      ilinkUserId: "user-1@im.wechat",
      contextToken: "ctx-1",
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://ilinkai.weixin.qq.com/ilink/bot/getconfig");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      ilink_user_id: "user-1@im.wechat",
      context_token: "ctx-1",
      base_info: {
        channel_version: "nextclaw-weixin/0.1.0",
      },
    });
  });

  it("posts sendtyping with explicit status and stable channel version", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ret: 0, errcode: 0 }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as typeof fetch;
    const api = new HttpWeixinApiClient();

    await api.sendTyping({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
      toUserId: "user-1@im.wechat",
      typingTicket: "ticket-1",
      status: 2,
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://ilinkai.weixin.qq.com/ilink/bot/sendtyping");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      ilink_user_id: "user-1@im.wechat",
      typing_ticket: "ticket-1",
      status: 2,
      base_info: {
        channel_version: "nextclaw-weixin/0.1.0",
      },
    });
  });

  it("uses the stable Weixin channel version when sending text", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ret: 0, errcode: 0, message_id: "remote-message-1" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as typeof fetch;
    const api = new HttpWeixinApiClient();

    await api.sendTextMessage({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
      toUserId: "user-1@im.wechat",
      text: "hello",
      contextToken: "ctx-1",
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      base_info: {
        channel_version: "nextclaw-weixin/0.1.0",
      },
      msg: {
        context_token: "ctx-1",
      },
    });
  });

  it("fails fast when sendmessage returns a business error", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ret: -3, errcode: -3, errmsg: "invalid context" }), { status: 200 }),
    ) as typeof fetch;
    const api = new HttpWeixinApiClient();

    await expect(api.sendTextMessage({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
      toUserId: "user-1@im.wechat",
      text: "hello",
    })).rejects.toThrow("weixin sendmessage failed: ret=-3, errcode=-3, errmsg=invalid context");
  });
});

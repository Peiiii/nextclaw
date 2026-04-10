import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWeixinConfig, sendWeixinTyping } from "../weixin-api.client.js";

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
});

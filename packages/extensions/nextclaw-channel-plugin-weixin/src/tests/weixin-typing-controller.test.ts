import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeixinTypingController } from "../weixin-typing-controller.js";

describe("WeixinTypingController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts keepalive, reuses cached ticket, and sends cancel on stop", async () => {
    const fetchTicket = vi.fn(async () => "ticket-1");
    const sendTyping = vi.fn(async () => {});
    const controller = new WeixinTypingController({
      heartbeatMs: 5_000,
      fetchTicket,
      sendTyping,
    });

    await controller.start({
      accountId: "bot-1@im.bot",
      userId: "user-1@im.wechat",
      contextToken: "ctx-1",
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
    });

    expect(fetchTicket).toHaveBeenCalledTimes(1);
    expect(sendTyping).toHaveBeenCalledTimes(1);
    expect(sendTyping).toHaveBeenLastCalledWith(
      expect.objectContaining({
        accountId: "bot-1@im.bot",
        userId: "user-1@im.wechat",
        ticket: "ticket-1",
        status: 1,
      }),
    );

    await vi.advanceTimersByTimeAsync(5_000);
    expect(sendTyping).toHaveBeenCalledTimes(2);
    expect(sendTyping).toHaveBeenLastCalledWith(expect.objectContaining({ status: 1 }));

    await controller.start({
      accountId: "bot-1@im.bot",
      userId: "user-1@im.wechat",
      contextToken: "ctx-2",
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
    });

    expect(fetchTicket).toHaveBeenCalledTimes(1);
    expect(sendTyping).toHaveBeenCalledWith(expect.objectContaining({ status: 1, contextToken: "ctx-2" }));

    await controller.stop({
      accountId: "bot-1@im.bot",
      userId: "user-1@im.wechat",
    });

    expect(sendTyping).toHaveBeenLastCalledWith(expect.objectContaining({ ticket: "ticket-1", status: 2 }));
  });

  it("refreshes expired ticket before starting again", async () => {
    let ticketCounter = 0;
    const fetchTicket = vi.fn(async () => {
      ticketCounter += 1;
      return `ticket-${ticketCounter}`;
    });
    const sendTyping = vi.fn(async () => {});
    const controller = new WeixinTypingController({
      heartbeatMs: 5_000,
      ticketTtlMs: 10_000,
      fetchTicket,
      sendTyping,
    });

    await controller.start({
      accountId: "bot-1@im.bot",
      userId: "user-1@im.wechat",
      contextToken: "ctx-1",
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
    });

    await controller.stop({
      accountId: "bot-1@im.bot",
      userId: "user-1@im.wechat",
      sendCancel: false,
    });
    await vi.advanceTimersByTimeAsync(10_001);

    await controller.start({
      accountId: "bot-1@im.bot",
      userId: "user-1@im.wechat",
      contextToken: "ctx-2",
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "bot-token",
    });

    expect(fetchTicket).toHaveBeenCalledTimes(2);
    expect(sendTyping).toHaveBeenLastCalledWith(expect.objectContaining({ ticket: "ticket-2", status: 1 }));
  });
});

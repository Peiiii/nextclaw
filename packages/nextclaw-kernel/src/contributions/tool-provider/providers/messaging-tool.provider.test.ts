import { describe, expect, it, vi } from "vitest";
import { MessagingToolProvider } from "./messaging-tool.provider.js";

function createProvider(deliver: (message: unknown) => Promise<boolean>) {
  return new MessagingToolProvider(
    {
      resolve: async () => ({
        toolRunContext: {
          channel: "ui",
          chatId: "web-ui",
          metadata: {},
        },
      }),
    } as never,
    { deliver } as never,
    {} as never,
    {
      getExtensionRegistry: () => ({
        channels: [{ channel: { id: "weixin" } }],
      }),
    } as never,
  );
}

describe("MessagingToolProvider", () => {
  it("executes message sends through the channel manager delivery owner", async () => {
    const deliver = vi.fn(async () => true);
    const provider = createProvider(deliver);
    const tools = await provider.provide({
      message: {
        metadata: {
          channel: "ui",
          chatId: "web-ui",
        },
        parts: [],
        role: "user",
      },
    } as never);

    const result = await tools.find((tool) => tool.name === "message")?.execute?.({
      channel: "weixin",
      to: "user-1@im.wechat",
      message: "hello",
    });

    expect(result).toBe("Message sent to weixin:user-1@im.wechat");
    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({
      channel: "weixin",
      chatId: "user-1@im.wechat",
      content: "hello",
    }));
  });

  it("fails the message tool when the target channel is unavailable", async () => {
    const provider = createProvider(async () => false);
    const tools = await provider.provide({
      message: {
        metadata: {},
        parts: [],
        role: "user",
      },
    } as never);

    await expect(tools.find((tool) => tool.name === "message")?.execute?.({
      channel: "weixin",
      to: "user-1@im.wechat",
      message: "hello",
    })).rejects.toThrow('channel "weixin" is not available');
  });
});

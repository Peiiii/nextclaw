import { describe, expect, it, vi } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import { MessagingToolProvider } from "./messaging-tool.provider.js";

function createKernel(deliver: (message: unknown) => Promise<boolean>) {
  return {
    channels: {
      deliver,
    },
    configManager: {
      loadConfig: () => ConfigSchema.parse({}),
    },
    extensions: {
      getExtensionRegistry: () => ({
        channels: [
          {
            channel: {
              id: "weixin",
            },
          },
        ],
      }),
    },
    sessionManager: {
      getAgentRunSession: async () => null,
    },
  };
}

describe("MessagingToolProvider", () => {
  it("executes message sends through the channel manager delivery owner", async () => {
    const deliver = vi.fn(async () => true);
    const provider = new MessagingToolProvider(createKernel(deliver) as never);
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
    const provider = new MessagingToolProvider(createKernel(async () => false) as never);
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

import { describe, expect, it, vi } from "vitest";
import type { ExtensionChannel } from "@nextclaw/extension-sdk";
import { WeixinExtensionRuntime } from "./weixin-extension-runtime.service.js";
import { WeixinChannelAdapterSkeleton } from "./weixin-channel-adapter.service.js";

function createChannel(config: Record<string, unknown>): ExtensionChannel {
  return {
    id: "weixin",
    config: {
      get: vi.fn(async () => config),
      onChange: vi.fn(() => vi.fn()),
    },
    submitMessage: vi.fn(async () => undefined),
    onNcpEvent: vi.fn(() => vi.fn()),
  };
}

describe("WeixinExtensionRuntime", () => {
  it("submits adapter messages through the extension channel", async () => {
    const channel = createChannel({ enabled: true });
    const adapter = new WeixinChannelAdapterSkeleton();
    const runtime = new WeixinExtensionRuntime(channel, adapter);

    await runtime.start();
    await adapter.emitMessageForTest({
      conversationId: "chat-1",
      senderId: "user-1",
      text: "hello",
      accountId: "account-1",
    });

    expect(channel.submitMessage).toHaveBeenCalledWith({
      conversationId: "chat-1",
      senderId: "user-1",
      content: {
        type: "text",
        text: "hello",
      },
      metadata: {
        accountId: "account-1",
        account_id: "account-1",
      },
    });
  });

  it("forwards NCP events to the adapter", async () => {
    let ncpHandler: ((event: unknown) => void | Promise<void>) | null = null;
    const channel = {
      ...createChannel({ enabled: true }),
      onNcpEvent: vi.fn((handler) => {
        ncpHandler = handler;
        return vi.fn();
      }),
    } satisfies ExtensionChannel;
    const adapter = {
      configure: vi.fn(async () => undefined),
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      onMessage: vi.fn(() => vi.fn()),
      sendNcpEvent: vi.fn(async () => undefined),
    };
    const runtime = new WeixinExtensionRuntime(channel, adapter);

    await runtime.start();
    await ncpHandler?.({
      type: "message.text-delta",
      payload: {
        sessionId: "session-1",
        messageId: "message-1",
        delta: "hello",
      },
    });

    expect(adapter.sendNcpEvent).toHaveBeenCalledWith({
      type: "message.text-delta",
      payload: {
        sessionId: "session-1",
        messageId: "message-1",
        delta: "hello",
      },
    });
  });
});

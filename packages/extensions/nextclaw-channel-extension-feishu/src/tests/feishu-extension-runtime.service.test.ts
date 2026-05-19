import { describe, expect, it, vi } from "vitest";
import type { ExtensionChannel } from "@nextclaw/extension-sdk";
import { FeishuExtensionRuntime } from "../services/feishu-extension-runtime.service.js";
import type { FeishuChannelAdapterContract } from "../types/feishu-extension.types.js";

function createChannel(config: Record<string, unknown>): ExtensionChannel {
  return {
    id: "feishu",
    config: {
      get: vi.fn(async () => config),
      onChange: vi.fn(() => vi.fn()),
    },
    submitMessage: vi.fn(async () => undefined),
    onNcpEvent: vi.fn(() => vi.fn()),
  };
}

function createAdapter(): FeishuChannelAdapterContract & {
  emit: Parameters<FeishuChannelAdapterContract["onMessage"]>[0];
} {
  let handler: Parameters<FeishuChannelAdapterContract["onMessage"]>[0] = async () => undefined;
  return {
    configure: vi.fn(async () => undefined),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    onMessage: vi.fn((nextHandler) => {
      handler = nextHandler;
      return vi.fn();
    }),
    sendNcpEvent: vi.fn(async () => undefined),
    emit: async (message) => await handler(message),
  };
}

describe("FeishuExtensionRuntime", () => {
  it("keeps start idempotent and drains subscription cleanups on stop", async () => {
    const cleanups = [vi.fn(), vi.fn(), vi.fn()];
    let cleanupIndex = 0;
    const nextCleanup = () => cleanups[cleanupIndex++] ?? vi.fn();
    const channel = {
      ...createChannel({ enabled: true }),
      onNcpEvent: vi.fn(nextCleanup),
      config: {
        get: vi.fn(async () => ({ enabled: true })),
        onChange: vi.fn(nextCleanup),
      },
    } satisfies ExtensionChannel;
    const adapter = {
      configure: vi.fn(async () => undefined),
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      onMessage: vi.fn(() => nextCleanup()),
      sendNcpEvent: vi.fn(async () => undefined),
    };
    const runtime = new FeishuExtensionRuntime(channel, adapter);

    await runtime.start();
    await runtime.start();
    await runtime.stop();

    for (const cleanup of cleanups) {
      expect(cleanup).toHaveBeenCalledTimes(1);
    }
    expect(adapter.onMessage).toHaveBeenCalledTimes(1);
    expect(channel.onNcpEvent).toHaveBeenCalledTimes(1);
    expect(channel.config.onChange).toHaveBeenCalledTimes(1);
  });

  it("submits Feishu chat id as the NCP peer route while keeping sender open id", async () => {
    const channel = createChannel({ enabled: true });
    const adapter = createAdapter();
    const runtime = new FeishuExtensionRuntime(channel, adapter);

    await runtime.start();
    await adapter.emit({
      conversationId: "oc-chat-1",
      senderId: "ou-user-1",
      text: "你好",
      accountId: "cli-account-1",
      peerKind: "direct",
      messageId: "om-message-1",
    });

    expect(channel.submitMessage).toHaveBeenCalledWith({
      conversationId: "oc-chat-1",
      senderId: "ou-user-1",
      content: {
        type: "text",
        text: "你好",
      },
      metadata: expect.objectContaining({
        account_id: "cli-account-1",
        peer_id: "oc-chat-1",
        peer_kind: "direct",
        message_id: "om-message-1",
      }),
    });
  });
});

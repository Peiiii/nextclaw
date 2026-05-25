import { describe, expect, it, vi } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import { FeishuChannelAdapter } from "../services/feishu-channel-adapter.service.js";
import type { FeishuSdkService } from "../services/feishu-sdk.service.js";
import type { FeishuAccountStore } from "../stores/feishu-account.store.js";

function createStore(): FeishuAccountStore {
  return {
    listAccountIds: vi.fn(() => []),
    loadAccount: vi.fn((accountId: string) => ({
      accountId,
      appId: "app-id",
      appSecret: "app-secret",
      domain: "feishu",
      botOpenId: "ou-bot",
    })),
    saveAccount: vi.fn(),
    deleteAccount: vi.fn(),
  };
}

function createSdk() {
  const handlers: Record<string, (data: unknown) => Promise<void>> = {};
  const sdk = {
    addReaction: vi.fn(async () => "reaction-1"),
    createClient: vi.fn(),
    createEventDispatcher: vi.fn(() => ({
      register: (nextHandlers: Record<string, (data: unknown) => Promise<void>>) => {
        Object.assign(handlers, nextHandlers);
      },
    })),
    createWsClient: vi.fn(() => ({
      start: vi.fn(),
      close: vi.fn(),
    })),
    deleteReaction: vi.fn(async () => undefined),
    sendText: vi.fn(async () => undefined),
  } as unknown as FeishuSdkService;
  return { handlers, sdk };
}

async function emitInboundMessage(
  handler: ((data: unknown) => Promise<void>) | undefined,
): Promise<void> {
  await handler?.({
    sender: {
      sender_id: { open_id: "ou-user" },
    },
    message: {
      chat_id: "oc-chat",
      chat_type: "p2p",
      content: JSON.stringify({ text: "hello" }),
      message_id: "om-message",
    },
  });
}

describe("FeishuChannelAdapter", () => {
  it("adds a typing reaction before dispatching accepted inbound messages", async () => {
    const { handlers, sdk } = createSdk();
    const adapter = new FeishuChannelAdapter({
      logger: { log: vi.fn(), warn: vi.fn() },
      sdk,
      store: createStore(),
    });
    const onMessage = vi.fn(async () => undefined);

    adapter.onMessage(onMessage);
    await adapter.configure({ enabled: true, defaultAccountId: "account-1" });
    await adapter.start();

    await emitInboundMessage(handlers["im.message.receive_v1"]);

    expect(sdk.addReaction).toHaveBeenCalledWith({
      account: expect.objectContaining({
        accountId: "account-1",
      }),
      emojiType: "Typing",
      messageId: "om-message",
    });
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "oc-chat",
      messageId: "om-message",
      text: "hello",
    }));
  });

  it("removes the typing reaction when NCP completes successfully", async () => {
    const { handlers, sdk } = createSdk();
    const adapter = new FeishuChannelAdapter({
      logger: { log: vi.fn(), warn: vi.fn() },
      sdk,
      store: createStore(),
    });

    adapter.onMessage(vi.fn(async () => undefined));
    await adapter.configure({ enabled: true, defaultAccountId: "account-1" });
    await adapter.start();
    await emitInboundMessage(handlers["im.message.receive_v1"]);

    await adapter.sendNcpEvent({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "agent:main:feishu:direct:oc-chat",
      },
    });

    expect(sdk.deleteReaction).toHaveBeenCalledWith({
      account: expect.objectContaining({
        accountId: "account-1",
      }),
      messageId: "om-message",
      reactionId: "reaction-1",
    });
    expect(sdk.addReaction).toHaveBeenCalledTimes(1);
  });

  it("replaces the typing reaction with CrossMark when NCP fails", async () => {
    const { handlers, sdk } = createSdk();
    const adapter = new FeishuChannelAdapter({
      logger: { log: vi.fn(), warn: vi.fn() },
      sdk,
      store: createStore(),
    });

    adapter.onMessage(vi.fn(async () => undefined));
    await adapter.configure({ enabled: true, defaultAccountId: "account-1" });
    await adapter.start();
    await emitInboundMessage(handlers["im.message.receive_v1"]);

    await adapter.sendNcpEvent({
      type: NcpEventType.RunError,
      payload: {
        error: "boom",
        sessionId: "agent:main:feishu:direct:oc-chat",
      },
    });

    expect(sdk.deleteReaction).toHaveBeenCalledWith(expect.objectContaining({
      messageId: "om-message",
      reactionId: "reaction-1",
    }));
    expect(sdk.addReaction).toHaveBeenLastCalledWith({
      account: expect.objectContaining({
        accountId: "account-1",
      }),
      emojiType: "CrossMark",
      messageId: "om-message",
    });
  });

  it("continues dispatching when the typing reaction fails", async () => {
    const { handlers, sdk } = createSdk();
    vi.mocked(sdk.addReaction).mockRejectedValueOnce(new Error("reaction denied"));
    const logger = { log: vi.fn(), warn: vi.fn() };
    const adapter = new FeishuChannelAdapter({
      logger,
      sdk,
      store: createStore(),
    });
    const onMessage = vi.fn(async () => undefined);

    adapter.onMessage(onMessage);
    await adapter.configure({ enabled: true, defaultAccountId: "account-1" });
    await adapter.start();

    await emitInboundMessage(handlers["im.message.receive_v1"]);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("failed to add processing reaction"));
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      messageId: "om-message",
      text: "hello",
    }));
  });

  it("sends outbound text through the selected account", async () => {
    const { sdk } = createSdk();
    const adapter = new FeishuChannelAdapter({
      logger: { log: vi.fn(), warn: vi.fn() },
      sdk,
      store: createStore(),
    });

    await adapter.configure({ enabled: true, defaultAccountId: "account-1" });
    await adapter.sendOutboundText({
      to: "oc-chat",
      text: "hello",
    });

    expect(sdk.sendText).toHaveBeenCalledWith({
      account: expect.objectContaining({
        accountId: "account-1",
      }),
      chatId: "oc-chat",
      text: "hello",
    });
  });

  it("starts only configured accounts when historical store accounts also exist", async () => {
    const { sdk } = createSdk();
    const store = createStore();
    vi.mocked(store.listAccountIds).mockReturnValue(["old-agent", "new-agent"]);
    const adapter = new FeishuChannelAdapter({
      logger: { log: vi.fn(), warn: vi.fn() },
      sdk,
      store,
    });

    await adapter.configure({ enabled: true, defaultAccountId: "new-agent" });
    await adapter.start();

    expect(sdk.createWsClient).toHaveBeenCalledTimes(1);
    expect(sdk.createWsClient).toHaveBeenCalledWith(expect.objectContaining({
      accountId: "new-agent",
    }));
  });
});

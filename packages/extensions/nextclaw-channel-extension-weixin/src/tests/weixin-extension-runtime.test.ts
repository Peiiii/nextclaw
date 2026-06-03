import { describe, expect, it, vi } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import { ExtensionChannelController, type ExtensionChannel } from "@nextclaw/extension-sdk";
import { WeixinChannelAdapter } from "../services/weixin-channel-adapter.service.js";
import type { WeixinApiClient } from "../services/weixin-api.service.js";
import type { StoredWeixinAccount, WeixinAccountStore } from "../stores/weixin-account.store.js";
import { toWeixinSubmittedMessage } from "../utils/weixin-submitted-message.utils.js";

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

describe("Weixin extension channel controller", () => {
  it("submits adapter messages through the extension channel", async () => {
    const channel = createChannel({ enabled: true });
    const adapter = new WeixinChannelAdapter({
      api: createIdleApi(),
      store: createMemoryStore(),
    });
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: toWeixinSubmittedMessage,
    });

    await controller.start();
    await adapter.emitMessageForTest({
      conversationId: "chat-1",
      senderId: "user-1",
      text: "hello",
      accountId: "account-1",
      contextToken: "ctx-1",
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
        context_token: "ctx-1",
      },
    });
    await controller.stop();
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
      sendOutboundText: vi.fn(async () => undefined),
    };
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: toWeixinSubmittedMessage,
    });

    await controller.start();
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

  it("forwards outbound text requests to the adapter", async () => {
    const channel = createChannel({ enabled: true });
    const adapter = {
      configure: vi.fn(async () => undefined),
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      onMessage: vi.fn(() => vi.fn()),
      sendNcpEvent: vi.fn(async () => undefined),
      sendOutboundText: vi.fn(async () => undefined),
    };
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: toWeixinSubmittedMessage,
    });

    await controller.start();
    await expect(controller.sendOutboundText({
      to: "user-1@im.wechat",
      text: "hello",
      accountId: "bot-1@im.bot",
    })).resolves.toEqual({ accepted: true });

    expect(adapter.sendOutboundText).toHaveBeenCalledWith({
      to: "user-1@im.wechat",
      text: "hello",
      accountId: "bot-1@im.bot",
    });
  });
});

describe("Weixin extension channel controller subscriptions", () => {
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
      onMessage: vi.fn(nextCleanup),
      sendNcpEvent: vi.fn(async () => undefined),
      sendOutboundText: vi.fn(async () => undefined),
    };
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: toWeixinSubmittedMessage,
    });

    await controller.start();
    await controller.start();
    await controller.stop();

    for (const cleanup of cleanups) {
      expect(cleanup).toHaveBeenCalledTimes(1);
    }
    expect(adapter.onMessage).toHaveBeenCalledTimes(1);
    expect(channel.onNcpEvent).toHaveBeenCalledTimes(1);
    expect(channel.config.onChange).toHaveBeenCalledTimes(1);
  });
});

describe("Weixin extension channel controller error handling", () => {
  it("keeps the extension channel controller alive when Weixin send fails", async () => {
    let ncpHandler: ((event: unknown) => void | Promise<void>) | null = null;
    const channel = {
      ...createChannel({ enabled: true }),
      onNcpEvent: vi.fn((handler) => {
        ncpHandler = handler;
        return vi.fn();
      }),
    } satisfies ExtensionChannel;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const adapter = {
      configure: vi.fn(async () => undefined),
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      onMessage: vi.fn(() => vi.fn()),
      sendNcpEvent: vi.fn(async () => {
        throw new Error("weixin sendmessage failed: ret=-3");
      }),
      sendOutboundText: vi.fn(async () => undefined),
    };
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: toWeixinSubmittedMessage,
      onNcpEventError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[weixin] failed to send NCP event: ${message}`);
      },
    });

    await controller.start();
    await expect(ncpHandler?.({
      type: "message.text-delta",
      payload: {
        sessionId: "session-1",
        messageId: "message-1",
        delta: "hello",
      },
    })).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith("[weixin] failed to send NCP event: weixin sendmessage failed: ret=-3");
    warn.mockRestore();
  });
});

describe("Weixin extension channel adapter flow", () => {
  it("polls Weixin messages and submits allowed inbound text", async () => {
    const channel = createChannel({ enabled: true, defaultAccountId: "bot-1@im.bot" });
    const api = createIdleApi();
    api.fetchUpdates = vi.fn()
      .mockResolvedValueOnce({
        get_updates_buf: "cursor-2",
        msgs: [{
          from_user_id: "user-1@im.wechat",
          context_token: "ctx-1",
          item_list: [{ type: 1, text_item: { text: "hello" } }],
        }],
      })
      .mockImplementation(async ({ signal }) => await waitUntilAbort(signal));
    const adapter = new WeixinChannelAdapter({
      api,
      store: createMemoryStore(),
      sleep: async () => undefined,
    });
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: toWeixinSubmittedMessage,
    });

    await controller.start();
    await waitFor(() => {
      expect(channel.submitMessage).toHaveBeenCalledWith(expect.objectContaining({
        conversationId: "user-1@im.wechat",
        senderId: "user-1@im.wechat",
        content: {
          type: "text",
          text: "hello",
        },
        metadata: expect.objectContaining({
          accountId: "bot-1@im.bot",
          account_id: "bot-1@im.bot",
          context_token: "ctx-1",
        }),
      }));
    });
    await controller.stop();
  });

  it("does not poll stored accounts that are not configured", async () => {
    const channel = createChannel({ enabled: true, defaultAccountId: "bot-1@im.bot" });
    const api = createIdleApi();
    api.fetchUpdates = vi.fn(async ({ signal }) => await waitUntilAbort(signal));
    const adapter = new WeixinChannelAdapter({
      api,
      store: createMemoryStore([
        {
          accountId: "bot-1@im.bot",
          token: "token-1",
          baseUrl: "https://ilinkai.weixin.qq.com",
        },
        {
          accountId: "stale-bot@im.bot",
          token: "stale-token",
          baseUrl: "https://ilinkai.weixin.qq.com",
        },
      ]),
    });
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: toWeixinSubmittedMessage,
    });

    await controller.start();

    expect(api.fetchUpdates).toHaveBeenCalledTimes(1);
    expect(api.fetchUpdates).toHaveBeenCalledWith(expect.objectContaining({
      token: "token-1",
    }));
    await controller.stop();
  });
});

describe("Weixin extension channel context_token delivery", () => {
  it("sends completed NCP replies back to Weixin conversation routes", async () => {
    const channel = createChannel({ enabled: true, defaultAccountId: "bot-1@im.bot" });
    let ncpHandler: ((event: Parameters<ExtensionChannel["onNcpEvent"]>[0] extends (event: infer T) => unknown ? T : never) => void | Promise<void>) | null = null;
    channel.onNcpEvent = vi.fn((handler) => {
      ncpHandler = handler;
      return vi.fn();
    });
    const api = createIdleApi();
    const store = createMemoryStore();
    store.saveContextToken("bot-1@im.bot", "user-1@im.wechat", "ctx-reply");
    const adapter = new WeixinChannelAdapter({
      api,
      store,
    });
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: toWeixinSubmittedMessage,
    });

    await controller.start();
    await ncpHandler?.({
      type: NcpEventType.MessageCompleted,
      payload: {
        message: {
          id: "assistant-1",
          sessionId: "agent:main:weixin:direct:user-1@im.wechat",
          role: "assistant",
          status: "final",
          timestamp: new Date().toISOString(),
          parts: [{ type: "text", text: "reply from ai" }],
        },
      },
    });

    expect(api.sendTextMessage).toHaveBeenCalledWith({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "token-1",
      toUserId: "user-1@im.wechat",
      text: "reply from ai",
      contextToken: "ctx-reply",
    });
    await controller.stop();
  });

  it("sends outbound message tool text through Weixin API", async () => {
    const channel = createChannel({ enabled: true, defaultAccountId: "bot-1@im.bot" });
    const api = createIdleApi();
    const store = createMemoryStore();
    store.saveContextToken("bot-1@im.bot", "user-1@im.wechat", "ctx-tool");
    const adapter = new WeixinChannelAdapter({
      api,
      store,
    });
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: toWeixinSubmittedMessage,
    });

    await controller.start();
    await controller.sendOutboundText({
      to: "user-1@im.wechat",
      text: "hello from message tool",
      accountId: "bot-1@im.bot",
    });

    expect(api.sendTextMessage).toHaveBeenCalledWith({
      baseUrl: "https://ilinkai.weixin.qq.com",
      token: "token-1",
      toUserId: "user-1@im.wechat",
      text: "hello from message tool",
      contextToken: "ctx-tool",
    });
    await controller.stop();
  });

  it("fails outbound sends before the Weixin API when context_token is missing", async () => {
    const channel = createChannel({ enabled: true, defaultAccountId: "bot-1@im.bot" });
    const api = createIdleApi();
    const controller = new ExtensionChannelController({
      channel,
      adapter: new WeixinChannelAdapter({
        api,
        store: createMemoryStore(),
      }),
      mapInbound: toWeixinSubmittedMessage,
    });

    await controller.start();
    await expect(controller.sendOutboundText({
      to: "user-1@im.wechat",
      text: "hello from message tool",
      accountId: "bot-1@im.bot",
    })).rejects.toThrow('weixin send failed: missing context_token for "user-1@im.wechat"');

    expect(api.sendTextMessage).not.toHaveBeenCalled();
    await controller.stop();
  });

  it("reuses persisted inbound context_token for later outbound sends", async () => {
    const store = createMemoryStore();
    const firstChannel = createChannel({ enabled: true, defaultAccountId: "bot-1@im.bot" });
    const firstApi = createIdleApi();
    firstApi.fetchUpdates = vi.fn()
      .mockResolvedValueOnce({
        get_updates_buf: "cursor-2",
        msgs: [{
          from_user_id: "user-1@im.wechat",
          context_token: "ctx-persisted",
          item_list: [{ type: 1, text_item: { text: "seed context" } }],
        }],
      })
      .mockImplementation(async ({ signal }) => await waitUntilAbort(signal));
    const firstController = new ExtensionChannelController({
      channel: firstChannel,
      adapter: new WeixinChannelAdapter({
        api: firstApi,
        store,
        sleep: async () => undefined,
      }),
      mapInbound: toWeixinSubmittedMessage,
    });

    await firstController.start();
    await waitFor(() => {
      expect(firstChannel.submitMessage).toHaveBeenCalledWith(expect.objectContaining({
        metadata: expect.objectContaining({
          context_token: "ctx-persisted",
        }),
      }));
    });
    await firstController.stop();

    const secondApi = createIdleApi();
    const secondController = new ExtensionChannelController({
      channel: createChannel({ enabled: true, defaultAccountId: "bot-1@im.bot" }),
      adapter: new WeixinChannelAdapter({
        api: secondApi,
        store,
      }),
      mapInbound: toWeixinSubmittedMessage,
    });

    await secondController.start();
    await secondController.sendOutboundText({
      to: "user-1@im.wechat",
      text: "later cron message",
    });

    expect(secondApi.sendTextMessage).toHaveBeenCalledWith(expect.objectContaining({
      contextToken: "ctx-persisted",
      text: "later cron message",
      toUserId: "user-1@im.wechat",
    }));
    await secondController.stop();
  });
});

describe("Weixin extension channel route normalization", () => {
  it("preserves configured Weixin conversation id casing when session ids are normalized", async () => {
    const channel = createChannel({
      enabled: true,
      defaultAccountId: "bot-1@im.bot",
      accounts: {
        "bot-1@im.bot": {
          allowFrom: ["User-Case@im.wechat"],
        },
      },
    });
    let ncpHandler: ((event: Parameters<ExtensionChannel["onNcpEvent"]>[0] extends (event: infer T) => unknown ? T : never) => void | Promise<void>) | null = null;
    channel.onNcpEvent = vi.fn((handler) => {
      ncpHandler = handler;
      return vi.fn();
    });
    const api = createIdleApi();
    const store = createMemoryStore();
    store.saveContextToken("bot-1@im.bot", "User-Case@im.wechat", "ctx-case");
    const adapter = new WeixinChannelAdapter({
      api,
      store,
    });
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: toWeixinSubmittedMessage,
    });

    await controller.start();
    await ncpHandler?.({
      type: NcpEventType.MessageCompleted,
      payload: {
        message: {
          id: "assistant-1",
          sessionId: "agent:main:weixin:direct:user-case@im.wechat",
          role: "assistant",
          status: "final",
          timestamp: new Date().toISOString(),
          parts: [{ type: "text", text: "reply from ai" }],
        },
      },
    });

    expect(api.sendTextMessage).toHaveBeenCalledWith(expect.objectContaining({
      toUserId: "User-Case@im.wechat",
      contextToken: "ctx-case",
    }));
    await controller.stop();
  });

  it("clears saved cursor when getupdates reports session timeout and resumes quietly", async () => {
    const store = createMemoryStore();
    store.saveCursor("bot-1@im.bot", "stale-cursor");
    const controller = new AbortController();
    const api = createIdleApi();
    api.fetchUpdates = vi.fn()
      .mockRejectedValueOnce(new Error("weixin getupdates failed: errcode=-14, errmsg=session timeout"))
      .mockImplementationOnce(async () => {
        controller.abort();
        return {
          ret: 0,
          msgs: [],
          get_updates_buf: "fresh-cursor",
        };
      });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const adapter = new WeixinChannelAdapter({
      api,
      store,
      sleep: async () => undefined,
    });

    (adapter as unknown as { running: boolean }).running = true;
    await (adapter as unknown as {
      runPollingLoop: (accountId: string, signal: AbortSignal) => Promise<void>;
    }).runPollingLoop("bot-1@im.bot", controller.signal);

    expect(store.loadCursor("bot-1@im.bot")).toBe("fresh-cursor");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("Weixin extension channel feature parity", () => {
  it("submits inbound file attachments and starts typing after user messages", async () => {
    const channel = createChannel({ enabled: true, defaultAccountId: "bot-1@im.bot" });
    const api = createIdleApi();
    api.fetchUpdates = vi.fn()
      .mockResolvedValueOnce({
        get_updates_buf: "cursor-2",
        msgs: [{
          from_user_id: "user-1@im.wechat",
          context_token: "ctx-1",
          item_list: [{ type: 4, file_item: { file_name: "report.pdf" } }],
        }],
      })
      .mockImplementation(async ({ signal }) => await waitUntilAbort(signal));
    const adapter = new WeixinChannelAdapter({
      api,
      store: createMemoryStore(),
      sleep: async () => undefined,
    });
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: toWeixinSubmittedMessage,
    });

    await controller.start();
    await waitFor(() => {
      expect(channel.submitMessage).toHaveBeenCalledWith(expect.objectContaining({
        content: {
          type: "text",
          text: "",
        },
        attachments: [expect.objectContaining({
          name: "report.pdf",
          status: "remote-only",
          errorCode: "invalid_payload",
        })],
      }));
      expect(api.sendTyping).toHaveBeenCalledWith(expect.objectContaining({
        status: 1,
        toUserId: "user-1@im.wechat",
        typingTicket: "typing-ticket-1",
      }));
    });
    await controller.stop();
  });

  it("streams text deltas back to Weixin before the completed event", async () => {
    const channel = createChannel({ enabled: true, defaultAccountId: "bot-1@im.bot" });
    let ncpHandler: ((event: Parameters<ExtensionChannel["onNcpEvent"]>[0] extends (event: infer T) => unknown ? T : never) => void | Promise<void>) | null = null;
    channel.onNcpEvent = vi.fn((handler) => {
      ncpHandler = handler;
      return vi.fn();
    });
    const api = createIdleApi();
    api.fetchUpdates = vi.fn()
      .mockResolvedValueOnce({
        get_updates_buf: "cursor-2",
        msgs: [{
          from_user_id: "user-1@im.wechat",
          context_token: "ctx-stream",
          item_list: [{ type: 1, text_item: { text: "hello" } }],
        }],
      })
      .mockImplementation(async ({ signal }) => await waitUntilAbort(signal));
    const adapter = new WeixinChannelAdapter({
      api,
      store: createMemoryStore(),
      sleep: async () => undefined,
    });
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: toWeixinSubmittedMessage,
    });

    await controller.start();
    await waitFor(() => {
      expect(channel.submitMessage).toHaveBeenCalledWith(expect.objectContaining({
        conversationId: "user-1@im.wechat",
        metadata: expect.objectContaining({
          context_token: "ctx-stream",
        }),
      }));
    });
    await ncpHandler?.({
      type: NcpEventType.MessageTextStart,
      payload: {
        sessionId: "agent:main:weixin:direct:user-1@im.wechat",
        messageId: "assistant-1",
      },
    });
    await ncpHandler?.({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "agent:main:weixin:direct:user-1@im.wechat",
        messageId: "assistant-1",
        delta: "streaming",
      },
    });
    await ncpHandler?.({
      type: NcpEventType.MessageTextEnd,
      payload: {
        sessionId: "agent:main:weixin:direct:user-1@im.wechat",
        messageId: "assistant-1",
      },
    });
    await ncpHandler?.({
      type: NcpEventType.MessageCompleted,
      payload: {
        message: {
          id: "assistant-1",
          sessionId: "agent:main:weixin:direct:user-1@im.wechat",
          role: "assistant",
          status: "final",
          timestamp: new Date().toISOString(),
          parts: [{ type: "text", text: "streaming" }],
        },
      },
    });

    await waitFor(() => {
      expect(api.sendTextMessage).toHaveBeenCalledWith(expect.objectContaining({
        text: "streaming",
        toUserId: "user-1@im.wechat",
      }));
      expect(api.sendTyping).toHaveBeenCalledWith(expect.objectContaining({
        status: 1,
        toUserId: "user-1@im.wechat",
        typingTicket: "typing-ticket-1",
      }));
      expect(api.sendTyping).toHaveBeenCalledWith(expect.objectContaining({
        status: 2,
        toUserId: "user-1@im.wechat",
        typingTicket: "typing-ticket-1",
      }));
    });
    await controller.stop();
  });
});

class TestWeixinAccountStore implements WeixinAccountStore {
  private cursor: string | undefined;
  private accounts = new Map<string, StoredWeixinAccount>();
  private contextTokens = new Map<string, string>();

  constructor(accounts: StoredWeixinAccount[] = [{
    accountId: "bot-1@im.bot",
    token: "token-1",
    baseUrl: "https://ilinkai.weixin.qq.com",
  }]) {
    for (const account of accounts) {
      this.accounts.set(account.accountId, account);
    }
  }

  listAccountIds = (): string[] => [...this.accounts.keys()];

  loadAccount = (accountId: string): StoredWeixinAccount | null => this.accounts.get(accountId) ?? null;

  saveAccount = (account: StoredWeixinAccount): void => {
    this.accounts.set(account.accountId, account);
  };

  deleteAccount = (accountId: string): void => {
    this.accounts.delete(accountId);
  };

  loadCursor = (): string | undefined => this.cursor;

  saveCursor = (_accountId: string, nextCursor: string | undefined): void => {
    this.cursor = nextCursor;
  };

  deleteCursor = (): void => {
    this.cursor = undefined;
  };

  loadContextToken = (accountId: string, conversationId: string): string | undefined =>
    this.contextTokens.get(`${accountId}:${conversationId}`);

  saveContextToken = (
    accountId: string,
    conversationId: string,
    contextToken: string,
  ): void => {
    this.contextTokens.set(`${accountId}:${conversationId}`, contextToken);
  };

}

function createMemoryStore(accounts?: StoredWeixinAccount[]): WeixinAccountStore {
  return new TestWeixinAccountStore(accounts);
}

function createIdleApi(): WeixinApiClient {
  return {
    fetchUpdates: vi.fn(async ({ signal }) => await waitUntilAbort(signal)),
    fetchConfig: vi.fn(async () => ({
      ret: 0,
      errcode: 0,
      typing_ticket: "typing-ticket-1",
    })),
    fetchQrCode: vi.fn(async () => ({
      qrcode: "qr-token",
      qrcode_img_content: "https://example.com/qr.png",
    })),
    fetchQrStatus: vi.fn(async () => ({ status: "wait" })),
    sendTyping: vi.fn(async () => ({ ret: 0, errcode: 0 })),
    sendMessageItem: vi.fn(async () => ({ messageId: "message-1" })),
    sendTextMessage: vi.fn(async () => ({ messageId: "message-1" })),
  };
}

async function waitUntilAbort(signal?: AbortSignal): Promise<{ msgs: []; ret: 0 }> {
  await new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    signal?.addEventListener("abort", () => resolve(), { once: true });
  });
  return { ret: 0, msgs: [] };
}

async function waitFor(assertion: () => void | Promise<void>): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < 1_000) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw lastError;
}

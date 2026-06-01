import { describe, expect, it, vi } from "vitest";
import {
  ExtensionChannelController,
  startBusChannelExtension,
  type ExtensionChannel,
  type ExtensionChannelAdapter,
  NextClawExtension,
  startChannelExtension,
  warnNcpEventError,
} from "./index.js";

type TestSocket = {
  url: string;
  options?: { headers?: Record<string, string> };
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: (() => void) | null;
  close: ReturnType<typeof vi.fn>;
};

function createFetchImpl(data: unknown = { accepted: true }): ReturnType<typeof vi.fn> {
  return vi.fn(async () =>
    new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

function createExtensionHarness(responseData?: unknown): {
  extension: NextClawExtension;
  fetchImpl: ReturnType<typeof vi.fn>;
  sockets: TestSocket[];
} {
  const sockets: TestSocket[] = [];
  const fetchImpl = createFetchImpl(responseData);
  const extension = new NextClawExtension({
    endpoint: "http://127.0.0.1:55667",
    extensionId: "fake-extension",
    token: "secret",
    fetch: fetchImpl,
    webSocketFactory: (url, options) => {
      const socket = {
        url,
        options,
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        close: vi.fn(),
      };
      sockets.push(socket);
      return socket;
    },
  });
  return { extension, fetchImpl, sockets };
}

function emitSocketEvent(socket: TestSocket | undefined, type: string, payload: unknown): void {
  socket?.onmessage?.({
    data: JSON.stringify({
      type,
      payload,
    }),
  });
}

type FakeConfig = {
  enabled?: boolean;
};

type FakeInbound = {
  conversationId: string;
  senderId: string;
  text: string;
};

type FakeBusInbound = {
  channel: string;
  senderId: string;
  chatId: string;
  content: string;
  attachments?: Array<{ id: string; name: string }>;
  metadata?: Record<string, unknown>;
};

type FakeControllerHarness = {
  adapter: ExtensionChannelAdapter<FakeConfig, FakeInbound> & {
    emit: (message: FakeInbound) => Promise<void>;
    sendOutboundText: ReturnType<typeof vi.fn>;
  };
  channel: ExtensionChannel;
  cleanups: Array<ReturnType<typeof vi.fn>>;
  ncpHandler: Parameters<ExtensionChannel["onNcpEvent"]>[0] | null;
  configChangeHandler: ((config: FakeConfig) => void | Promise<void>) | null;
};

function createControllerHarness(configs: FakeConfig[]): FakeControllerHarness {
  const cleanups = [vi.fn(), vi.fn(), vi.fn()];
  let cleanupIndex = 0;
  let messageHandler: ((message: FakeInbound) => void | Promise<void>) | null = null;
  let ncpHandler: Parameters<ExtensionChannel["onNcpEvent"]>[0] | null = null;
  let configChangeHandler: ((config: FakeConfig) => void | Promise<void>) | null = null;
  const nextCleanup = () => cleanups[cleanupIndex++] ?? vi.fn();
  const channel: ExtensionChannel = {
    id: "fake",
    config: {
      get: vi.fn(async () => configs.shift() ?? {}),
      onChange: vi.fn((handler) => {
        configChangeHandler = handler as (config: FakeConfig) => void | Promise<void>;
        return nextCleanup();
      }),
    },
    submitMessage: vi.fn(async () => undefined),
    onNcpEvent: vi.fn((handler) => {
      ncpHandler = handler;
      return nextCleanup();
    }),
  };
  const adapter = {
    configure: vi.fn(async () => undefined),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    onMessage: vi.fn((handler) => {
      messageHandler = handler;
      return nextCleanup();
    }),
    sendNcpEvent: vi.fn(async () => undefined),
    sendOutboundText: vi.fn(async () => undefined),
    emit: async (message: FakeInbound) => {
      await messageHandler?.(message);
    },
  };
  return {
    adapter,
    channel,
    cleanups,
    get ncpHandler() {
      return ncpHandler;
    },
    get configChangeHandler() {
      return configChangeHandler;
    },
  };
}

describe("@nextclaw/extension-sdk", () => {
  it("submits channel messages through the ingress endpoint", async () => {
    const fetchImpl = createFetchImpl();
    const extension = new NextClawExtension({
      endpoint: "http://127.0.0.1:55667",
      extensionId: "fake-extension",
      token: "secret",
      fetch: fetchImpl,
    });
    const channel = extension.channels.use("fake");

    await channel.submitMessage({
      conversationId: "conversation-1",
      senderId: "user-1",
      content: {
        type: "text",
        text: "hello",
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:55667/webhook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer secret",
        }),
      }),
    );
    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual(
      expect.objectContaining({
        type: "extension.channel.message.submit",
        extensionId: "fake-extension",
        payload: expect.objectContaining({
          channelId: "fake",
          conversationId: "conversation-1",
        }),
      }),
    );
  });

  it("routes websocket events through eventBus-backed channel APIs", async () => {
    const { extension, sockets } = createExtensionHarness({ config: { enabled: true, token: "updated" } });
    const channel = extension.channels.use("fake");
    const ncpHandler = vi.fn();
    const configHandler = vi.fn();

    channel.onNcpEvent(ncpHandler);
    channel.config.onChange(configHandler);
    emitSocketEvent(sockets[0], "ncp.event", {
      type: "message.text-delta",
      payload: {
        sessionId: "session-1",
        messageId: "message-1",
        delta: "hi",
      },
    });
    emitSocketEvent(sockets[0], "config.updated", { path: "channels.fake" });
    await vi.waitFor(() => expect(configHandler).toHaveBeenCalled());

    expect(sockets[0]?.url).toBe("ws://127.0.0.1:55667/ws");
    expect(sockets[0]?.options?.headers).toEqual({
      authorization: "Bearer secret",
      "x-nextclaw-extension-id": "fake-extension",
    });
    expect(ncpHandler).toHaveBeenCalledWith(
      {
        type: "message.text-delta",
        payload: {
          sessionId: "session-1",
          messageId: "message-1",
          delta: "hi",
        },
      },
    );
    expect(configHandler).toHaveBeenCalledWith(
      { enabled: true, token: "updated" },
    );
  });

  it("handles extension requests and responds through ingress", async () => {
    const { extension, fetchImpl, sockets } = createExtensionHarness();

    extension.onRequest(async (request) => ({
      handled: request.kind,
    }));
    emitSocketEvent(sockets[0], "extension.request", {
      requestId: "request-1",
      extensionId: "fake-extension",
      kind: "channel.auth.start",
      payload: {
        channelId: "fake",
      },
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({
      type: "extension.response",
      payload: {
        requestId: "request-1",
        ok: true,
        data: {
          handled: "channel.auth.start",
        },
      },
    }));
  });

  it("maps channel auth capability methods to standard extension requests", async () => {
    const { extension, fetchImpl, sockets } = createExtensionHarness();
    const start = vi.fn(async () => ({ sessionId: "session-1" }));
    const poll = vi.fn(async () => ({ status: "authorized" }));
    const login = vi.fn(async () => ({ accountId: "account-1" }));

    extension.capabilities.provide("channel.auth", { start, poll, login });
    emitSocketEvent(sockets[0], "extension.request", {
      requestId: "request-start",
      extensionId: "fake-extension",
      kind: "channel.auth.start",
      payload: {
        channelId: "fake",
        accountId: "account-1",
        baseUrl: "https://example.com",
      },
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());

    expect(start).toHaveBeenCalledWith(
      {
        channelId: "fake",
        accountId: "account-1",
        baseUrl: "https://example.com",
      },
      expect.objectContaining({
        kind: "channel.auth.start",
        requestId: "request-start",
      }),
    );
    expect(poll).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({
      type: "extension.response",
      payload: {
        requestId: "request-start",
        ok: true,
        data: {
          sessionId: "session-1",
        },
      },
    }));
  });

  it("maps single capability handlers to exact extension request kinds", async () => {
    const { extension, fetchImpl, sockets } = createExtensionHarness();
    const handler = vi.fn(async () => ({ ok: "single" }));

    extension.capabilities.provideHandler("channel.health.check", handler);
    emitSocketEvent(sockets[0], "extension.request", {
      requestId: "request-health",
      extensionId: "fake-extension",
      kind: "channel.health.check",
      payload: {
        channelId: "fake",
      },
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());

    expect(handler).toHaveBeenCalledWith(
      { channelId: "fake" },
      expect.objectContaining({
        kind: "channel.health.check",
        requestId: "request-health",
      }),
    );
    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({
      type: "extension.response",
      payload: {
        requestId: "request-health",
        ok: true,
        data: {
          ok: "single",
        },
      },
    }));
  });

});

describe("channel extension bootstrap", () => {
  it("starts channel extension definitions with standard capability helpers", async () => {
    const sockets: TestSocket[] = [];
    const fetchImpl = createFetchImpl({ config: { enabled: true } });
    const adapter = {
      configure: vi.fn(async () => undefined),
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      onMessage: vi.fn(() => vi.fn()),
      sendNcpEvent: vi.fn(async () => undefined),
      sendOutboundText: vi.fn(async () => undefined),
    };
    const authStart = vi.fn(async () => ({ sessionId: "session-1" }));

    await startChannelExtension(
      {
        channelId: "fake",
        createAdapter: () => adapter,
        mapInbound: (message: FakeInbound) => ({
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: { type: "text", text: message.text },
        }),
        createAuthCapability: () => ({ start: authStart }),
        onNcpEventError: warnNcpEventError("fake"),
      },
      {
        endpoint: "http://127.0.0.1:55667",
        extensionId: "fake-extension",
        token: "secret",
        fetch: fetchImpl,
        webSocketFactory: (url) => {
          const socket = {
            url,
            onopen: null,
            onmessage: null,
            onerror: null,
            onclose: null,
            close: vi.fn(),
          };
          sockets.push(socket);
          return socket;
        },
      },
    );
    fetchImpl.mockClear();

    emitSocketEvent(sockets[0], "extension.request", {
      requestId: "request-outbound",
      extensionId: "fake-extension",
      kind: "channel.outbound.sendText",
      payload: {
        to: "user-1",
        text: "hello",
      },
    });
    emitSocketEvent(sockets[0], "extension.request", {
      requestId: "request-auth",
      extensionId: "fake-extension",
      kind: "channel.auth.start",
      payload: {
        channelId: "fake",
      },
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));

    expect(adapter.configure).toHaveBeenCalledWith({ enabled: true });
    expect(adapter.start).toHaveBeenCalledTimes(1);
    expect(adapter.sendOutboundText).toHaveBeenCalledWith({
      to: "user-1",
      text: "hello",
      accountId: undefined,
    });
    expect(authStart).toHaveBeenCalledWith(
      { channelId: "fake" },
      expect.objectContaining({ kind: "channel.auth.start" }),
    );
  });
});

describe("bus channel extension bootstrap", () => {
  it("starts bus channel extensions without waiting for long-running channel start", async () => {
    const fetchImpl = createFetchImpl({ config: { enabled: true, token: "secret" } });
    let resolveStarted: (() => void) | null = null;
    const startPromise = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const channel = {
      start: vi.fn(() => startPromise),
      stop: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
    };
    const createChannel = vi.fn(() => channel);

    await expect(startBusChannelExtension(
      {
        channelId: "fake",
        createChannel,
      },
      {
        endpoint: "http://127.0.0.1:55667",
        extensionId: "fake-extension",
        token: "secret",
        fetch: fetchImpl,
      },
    )).resolves.toBeUndefined();

    expect(createChannel).toHaveBeenCalledWith(expect.objectContaining({
      config: { enabled: true, token: "secret" },
      bus: expect.objectContaining({ publishInbound: expect.any(Function) }),
    }));
    expect(channel.start).toHaveBeenCalledTimes(1);
    resolveStarted?.();
  });

  it("maps bus inbound messages to submitted extension text messages", async () => {
    const fetchImpl = createFetchImpl({ config: { enabled: true } });
    let bus: { publishInbound: (message: FakeBusInbound) => Promise<void> } | null = null;
    const channel = {
      start: vi.fn(async () => {
        await bus?.publishInbound({
          channel: "fake",
          chatId: "chat-1",
          senderId: "sender-1",
          content: "hello",
          attachments: [{ id: "file-1", name: "a.txt" }],
          metadata: { message_id: "message-1" },
        });
      }),
      stop: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
    };

    await startBusChannelExtension(
      {
        channelId: "fake",
        createChannel: (context) => {
          bus = context.bus;
          return channel;
        },
      },
      {
        endpoint: "http://127.0.0.1:55667",
        extensionId: "fake-extension",
        token: "secret",
        fetch: fetchImpl,
      },
    );
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));

    const [, init] = fetchImpl.mock.calls[1] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({
      type: "extension.channel.message.submit",
      payload: {
        channelId: "fake",
        conversationId: "chat-1",
        senderId: "sender-1",
        content: { type: "text", text: "hello" },
        attachments: [{ id: "file-1", name: "a.txt" }],
        metadata: { message_id: "message-1" },
      },
    }));
  });

  it("maps outbound text requests to bus channel send calls", async () => {
    const { fetchImpl, sockets } = createExtensionHarness({ config: { enabled: true } });
    const channel = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
    };

    await startBusChannelExtension(
      {
        channelId: "fake",
        createChannel: () => channel,
      },
      {
        endpoint: "http://127.0.0.1:55667",
        extensionId: "fake-extension",
        token: "secret",
        fetch: fetchImpl,
        webSocketFactory: (url) => {
          const socket = {
            url,
            onopen: null,
            onmessage: null,
            onerror: null,
            onclose: null,
            close: vi.fn(),
          };
          sockets.push(socket);
          return socket;
        },
      },
    );
    emitSocketEvent(sockets[0], "extension.request", {
      requestId: "request-outbound",
      extensionId: "fake-extension",
      kind: "channel.outbound.sendText",
      payload: {
        to: "chat-1",
        text: "hello",
        accountId: "account-1",
        replyTo: "message-1",
        media: ["asset-1"],
        metadata: {
          qq: {
            messageType: "group",
            groupId: "group-1",
            userId: "user-1",
          },
        },
      },
    });
    await vi.waitFor(() => expect(channel.send).toHaveBeenCalled());

    expect(channel.send).toHaveBeenCalledWith({
      channel: "fake",
      chatId: "chat-1",
      content: "hello",
      replyTo: "message-1",
      media: ["asset-1"],
      metadata: {
        accountId: "account-1",
        qq: {
          messageType: "group",
          groupId: "group-1",
          userId: "user-1",
        },
      },
    });
  });
});

describe("bus channel extension replies", () => {
  it("maps completed NCP events to bus channel replies", async () => {
    const { fetchImpl, sockets } = createExtensionHarness({ config: { enabled: true } });
    const channel = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
    };

    await startBusChannelExtension(
      {
        channelId: "fake",
        createChannel: () => channel,
      },
      {
        endpoint: "http://127.0.0.1:55667",
        extensionId: "fake-extension",
        token: "secret",
        fetch: fetchImpl,
        webSocketFactory: (url) => {
          const socket = {
            url,
            onopen: null,
            onmessage: null,
            onerror: null,
            onclose: null,
            close: vi.fn(),
          };
          sockets.push(socket);
          return socket;
        },
      },
    );
    emitSocketEvent(sockets[0], "ncp.event", {
      type: "message.completed",
      payload: {
        message: {
          id: "assistant-1",
          role: "assistant",
          status: "final",
          sessionId: "session-1",
          timestamp: "2026-05-22T00:00:00.000Z",
          parts: [{ type: "text", text: "reply" }],
          metadata: {
            channel: "fake",
            chatId: "chat-1",
            message_id: "message-1",
            nextclaw_channel_trace_id: "trace-1",
          },
        },
      },
    });
    await vi.waitFor(() => expect(channel.send).toHaveBeenCalled());

    expect(channel.send).toHaveBeenCalledWith({
      channel: "fake",
      chatId: "chat-1",
      content: "reply",
      replyTo: "message-1",
      media: [],
      metadata: {
        channel: "fake",
        chatId: "chat-1",
        message_id: "message-1",
        nextclaw_channel_trace_id: "trace-1",
      },
    });
  });

  it("falls back to the agent session id when completed messages omit route metadata", async () => {
    const { fetchImpl, sockets } = createExtensionHarness({ config: { enabled: true } });
    const channel = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
    };

    await startBusChannelExtension(
      {
        channelId: "qq",
        createChannel: () => channel,
      },
      {
        endpoint: "http://127.0.0.1:55667",
        extensionId: "fake-extension",
        token: "secret",
        fetch: fetchImpl,
        webSocketFactory: (url) => {
          const socket = {
            url,
            onopen: null,
            onmessage: null,
            onerror: null,
            onclose: null,
            close: vi.fn(),
          };
          sockets.push(socket);
          return socket;
        },
      },
    );
    emitSocketEvent(sockets[0], "ncp.event", {
      type: "message.completed",
      payload: {
        message: {
          id: "assistant-1",
          role: "assistant",
          status: "final",
          sessionId: "agent:joker:qq:direct:chat-1",
          timestamp: "2026-05-22T00:00:00.000Z",
          parts: [{ type: "text", text: "reply" }],
          metadata: {},
        },
      },
    });
    await vi.waitFor(() => expect(channel.send).toHaveBeenCalled());

    expect(channel.send).toHaveBeenCalledWith({
      channel: "qq",
      chatId: "chat-1",
      content: "reply",
      media: [],
      metadata: {},
    });
  });

  it("stops bus channels when config disables them", async () => {
    const fetchImpl = createFetchImpl({ config: { enabled: false } });
    const channel = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      send: vi.fn(async () => undefined),
    };

    await startBusChannelExtension(
      {
        channelId: "fake",
        createChannel: () => channel,
      },
      {
        endpoint: "http://127.0.0.1:55667",
        extensionId: "fake-extension",
        token: "secret",
        fetch: fetchImpl,
      },
    );

    expect(channel.start).not.toHaveBeenCalled();
    expect(channel.stop).toHaveBeenCalledTimes(1);
  });
});

describe("ExtensionChannelController", () => {
  it("submits adapter messages through the extension channel", async () => {
    const { adapter, channel } = createControllerHarness([{ enabled: true }]);
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: (message: FakeInbound) => ({
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: {
          type: "text",
          text: message.text,
        },
      }),
    });

    await controller.start();
    await adapter.emit({
      conversationId: "conversation-1",
      senderId: "user-1",
      text: "hello",
    });

    expect(channel.submitMessage).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      senderId: "user-1",
      content: {
        type: "text",
        text: "hello",
      },
    });
  });

  it("keeps subscriptions idempotent and drains cleanups on stop", async () => {
    const { adapter, channel, cleanups } = createControllerHarness([{ enabled: true }]);
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: (message: FakeInbound) => ({
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: { type: "text", text: message.text },
      }),
    });

    await controller.start();
    await controller.start();
    await controller.stop();
    await controller.stop();

    for (const cleanup of cleanups) {
      expect(cleanup).toHaveBeenCalledTimes(1);
    }
    expect(adapter.onMessage).toHaveBeenCalledTimes(1);
    expect(channel.onNcpEvent).toHaveBeenCalledTimes(1);
    expect(channel.config.onChange).toHaveBeenCalledTimes(1);
    expect(adapter.stop).toHaveBeenCalledTimes(1);
  });

  it("applies config changes and stops disabled channels", async () => {
    const harness = createControllerHarness([{ enabled: true }, { enabled: false }]);
    const controller = new ExtensionChannelController({
      channel: harness.channel,
      adapter: harness.adapter,
      mapInbound: (message: FakeInbound) => ({
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: { type: "text", text: message.text },
      }),
    });

    await controller.start();
    await harness.configChangeHandler?.({ enabled: false });

    expect(harness.adapter.configure).toHaveBeenNthCalledWith(1, { enabled: true });
    expect(harness.adapter.configure).toHaveBeenNthCalledWith(2, { enabled: false });
    expect(harness.adapter.start).toHaveBeenCalledTimes(1);
    expect(harness.adapter.stop).toHaveBeenCalledTimes(1);
  });

  it("forwards NCP events and delegates errors to the configured handler", async () => {
    const harness = createControllerHarness([{ enabled: true }]);
    const onNcpEventError = vi.fn();
    harness.adapter.sendNcpEvent.mockRejectedValueOnce(new Error("send failed"));
    const controller = new ExtensionChannelController({
      channel: harness.channel,
      adapter: harness.adapter,
      mapInbound: (message: FakeInbound) => ({
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: { type: "text", text: message.text },
      }),
      onNcpEventError,
    });
    const event = {
      type: "message.text-delta",
      payload: {
        sessionId: "session-1",
        messageId: "message-1",
        delta: "hi",
      },
    };

    await controller.start();
    await harness.ncpHandler?.(event);

    expect(harness.adapter.sendNcpEvent).toHaveBeenCalledWith(event);
    expect(onNcpEventError).toHaveBeenCalledWith(expect.any(Error), event);
  });

  it("forwards outbound text when the adapter supports it", async () => {
    const { adapter, channel } = createControllerHarness([{ enabled: true }]);
    const controller = new ExtensionChannelController({
      channel,
      adapter,
      mapInbound: (message: FakeInbound) => ({
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: { type: "text", text: message.text },
      }),
    });

    await expect(controller.sendOutboundText({
      to: "user-1",
      text: "hello",
      accountId: "account-1",
    })).resolves.toEqual({ accepted: true });

    expect(adapter.sendOutboundText).toHaveBeenCalledWith({
      to: "user-1",
      text: "hello",
      accountId: "account-1",
    });
  });

});

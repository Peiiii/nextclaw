import { describe, expect, it, vi } from "vitest";
import { startBusChannelExtension } from "./index.js";

type TestSocket = {
  url: string;
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
  fetchImpl: ReturnType<typeof vi.fn>;
  sockets: TestSocket[];
} {
  const sockets: TestSocket[] = [];
  const fetchImpl = createFetchImpl(responseData);
  return { fetchImpl, sockets };
}

function createTestSocketFactory(sockets: TestSocket[]) {
  return (url: string): TestSocket => {
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
  };
}

function emitSocketEvent(socket: TestSocket | undefined, type: string, payload: unknown): void {
  socket?.onmessage?.({
    data: JSON.stringify({
      type,
      payload,
    }),
  });
}

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
        webSocketFactory: createTestSocketFactory(sockets),
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
        webSocketFactory: createTestSocketFactory(sockets),
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
        webSocketFactory: createTestSocketFactory([]),
      },
    );

    expect(channel.start).not.toHaveBeenCalled();
    expect(channel.stop).toHaveBeenCalledTimes(1);
  });
});

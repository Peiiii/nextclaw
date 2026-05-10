import { describe, expect, it, vi } from "vitest";
import { NextClawExtension } from "./index.js";

describe("@nextclaw/extension-sdk", () => {
  it("submits channel messages through the ingress endpoint", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, data: { accepted: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
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
    const sockets: Array<{
      url: string;
      onopen: (() => void) | null;
      onmessage: ((event: { data: unknown }) => void) | null;
      onerror: ((event: unknown) => void) | null;
      onclose: (() => void) | null;
      close: ReturnType<typeof vi.fn>;
    }> = [];
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ config: { enabled: true, token: "updated" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const extension = new NextClawExtension({
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
    });
    const channel = extension.channels.use("fake");
    const ncpHandler = vi.fn();
    const configHandler = vi.fn();

    channel.onNcpEvent(ncpHandler);
    channel.config.onChange(configHandler);
    sockets[0]?.onmessage?.({
      data: JSON.stringify({
        type: "ncp.event",
        payload: {
          type: "message.text-delta",
          payload: {
            sessionId: "session-1",
            messageId: "message-1",
            delta: "hi",
          },
        },
      }),
    });
    sockets[0]?.onmessage?.({
      data: JSON.stringify({
        type: "config.updated",
        payload: { path: "channels.fake" },
      }),
    });
    await vi.waitFor(() => expect(configHandler).toHaveBeenCalled());

    expect(sockets[0]?.url).toBe("ws://127.0.0.1:55667/ws");
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
});

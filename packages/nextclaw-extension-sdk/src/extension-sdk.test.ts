import { describe, expect, it, vi } from "vitest";
import { NextClawExtension } from "./index.js";

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

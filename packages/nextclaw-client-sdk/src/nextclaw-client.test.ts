import { describe, expect, it, vi } from "vitest";
import { eventKeys, NextClawClient, NextClawClientError } from "./index.js";

describe("@nextclaw/client-sdk", () => {
  it("lists sessions from the existing ncp api", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            sessions: [{ sessionId: "session-1", messageCount: 3, updatedAt: "2026-05-06T00:00:00.000Z" }],
            total: 1
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667/",
      fetchImpl
    });

    const result = await client.sessions.list();

    expect(result.total).toBe(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:55667/api/ncp/sessions",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("builds agent avatar urls without adding new api shapes", () => {
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667"
    });

    expect(client.agents.resolveAvatarUrl("writer/default")).toBe(
      "http://127.0.0.1:55667/api/agents/writer%2Fdefault/avatar"
    );
  });

  it("maps agent run send and abort to the standard agent-runs api", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/agent-runs/send")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              sessionId: "session-1",
              userMessageId: "user-1",
              assistantMessageId: null,
              runId: "run-1"
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          data: { accepted: true }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667/",
      fetchImpl
    });

    await expect(client.agentRuns.send({
      content: [{ type: "text", text: "hello" }],
      metadata: { agentId: "writer/default" }
    })).resolves.toMatchObject({
      runId: "run-1",
      sessionId: "session-1"
    });
    await expect(client.agentRuns.abort({ sessionId: "session-1" }))
      .resolves.toEqual({ accepted: true });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:55667/api/agent-runs/send",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:55667/api/agent-runs/abort",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("streams agent run events from the standard agent-runs api", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          "event: ncp-event\n" +
          "data: {\"type\":\"run.started\",\"payload\":{\"sessionId\":\"session-1\",\"runId\":\"run-1\"}}\n\n"
        ));
        controller.close();
      }
    });
    const fetchImpl = vi.fn(async () => new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" }
    }));
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      fetchImpl
    });
    const events: unknown[] = [];

    client.agentRuns.stream({ sessionId: "session-1" }, (event) => {
      events.push(event);
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual([
      { type: "run.started", payload: { sessionId: "session-1", runId: "run-1" } }
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:55667/api/agent-runs/stream?sessionId=session-1",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("reconnects websocket subscriptions through the shared realtime service", () => {
    vi.useFakeTimers();
    const sockets: Array<{
      url: string;
      close: ReturnType<typeof vi.fn>;
      onopen: ((event: unknown) => void) | null;
      onmessage: ((event: { data?: unknown }) => void) | null;
      onerror: ((event: unknown) => void) | null;
      onclose: ((event: unknown) => void) | null;
    }> = [];
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      webSocketFactory: (url) => {
        const socket = {
          url,
          close: vi.fn(),
          onopen: null,
          onmessage: null,
          onerror: null,
          onclose: null
        };
        sockets.push(socket);
        return socket;
      }
    });
    expect(sockets).toHaveLength(0);
    const handler = vi.fn();
    const subscription = client.sessions.subscribe(handler);
    const eventBusHandler = vi.fn();
    const unsubscribeEventBus = client.eventBus.on(eventKeys.sessionRunStatus, eventBusHandler);

    sockets[0]?.onmessage?.({
      data: JSON.stringify({ type: "session.run-status", payload: { sessionKey: "s1", status: "running" } })
    });
    sockets[0]?.onclose?.({});
    vi.advanceTimersByTime(1100);

    subscription.close();
    unsubscribeEventBus();
    vi.useRealTimers();

    expect(sockets[0]?.url).toBe("ws://127.0.0.1:55667/ws");
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      type: "session.run-status",
      payload: { sessionKey: "s1", status: "running" },
      source: "realtime"
    }));
    expect(eventBusHandler).toHaveBeenCalledWith(
      { sessionKey: "s1", status: "running" },
      expect.objectContaining({ type: "session.run-status", source: "realtime" })
    );
    expect(sockets).toHaveLength(2);
    expect(sockets[1]?.close).toHaveBeenCalledTimes(1);
  });

  it("throws a typed client error for api failures", async () => {
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      fetchImpl: vi.fn(async () => {
        return new Response(
          JSON.stringify({
            ok: false,
            error: { code: "FORBIDDEN", message: "forbidden" }
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      })
    });

    await expect(client.sessions.list()).rejects.toBeInstanceOf(NextClawClientError);
  });

  it("preserves transport error metadata", async () => {
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      transport: {
        request: async () => {
          const error = new Error("authorization required") as Error & {
            code?: string;
            details?: Record<string, unknown>;
            status?: number;
          };
          error.code = "AUTHORIZATION_REQUIRED";
          error.details = { actionId: "notes.write" };
          error.status = 403;
          throw error;
        }
      }
    });

    await expect(client.serviceApps.listServiceApps()).rejects.toMatchObject({
      code: "AUTHORIZATION_REQUIRED",
      details: { actionId: "notes.write" },
      status: 403
    });
  });
});

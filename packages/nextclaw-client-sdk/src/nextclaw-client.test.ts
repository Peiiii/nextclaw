import { expect, it, vi } from "vitest";
import {
  createNextClawAppClient,
  eventKeys,
  NextClawClient,
  NextClawClientError
} from "./index.js";

  it("lists registered projects from the project registry api", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        projects: [{
          name: "Knowledge",
          rootPath: "/tmp/knowledge",
          createdAt: "2026-07-15T00:00:00.000Z",
          updatedAt: "2026-07-15T00:00:00.000Z",
        }],
        templates: [],
        total: 1,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      fetchImpl,
    });

    await expect(client.projects.list()).resolves.toMatchObject({ total: 1 });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:55667/api/projects",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("serializes cron pagination and filtering through the config service", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        jobs: [],
        total: 0,
        summary: { total: 0, enabled: 0, disabled: 0, attention: 0 },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      fetchImpl,
    });

    await client.config.fetchCronJobs({
      all: true,
      limit: 10,
      offset: 20,
      query: "risk",
      status: "attention",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:55667/api/cron?all=1&limit=10&offset=20&query=risk&status=attention",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("creates a server directory through the shared path service", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: { path: "/workspace/new-folder" },
    }), { status: 201, headers: { "Content-Type": "application/json" } }));
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      fetchImpl,
    });

    await expect(client.serverPaths.createDirectory({
      parentPath: "/workspace",
      name: "new-folder",
    })).resolves.toEqual({ path: "/workspace/new-folder" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:55667/api/server-paths/directory",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ parentPath: "/workspace", name: "new-folder" }),
      }),
    );
  });

  it("searches server paths within an explicit project root", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        basePath: "/workspace/project",
        query: "server",
        entries: [],
        truncated: false,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      fetchImpl,
    });

    await expect(client.serverPaths.search({
      basePath: "/workspace/project",
      query: "server",
      limit: 25,
    })).resolves.toMatchObject({ query: "server" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:55667/api/server-paths/search?basePath=%2Fworkspace%2Fproject&query=server&limit=25",
      expect.objectContaining({ method: "GET" }),
    );
  });

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

    const result = await client.sessions.list({ limit: 10, peerId: "peer-1" });

    expect(result.total).toBe(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:55667/api/ncp/sessions?limit=10&peerId=peer-1",
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

  it("calls browser fetch with the global receiver", async () => {
    const originalFetch = globalThis.fetch;
    const fetchImpl = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve(new Response(
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
      ));
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667"
    });

    try {
      await expect(client.agentRuns.send({
        content: [{ type: "text", text: "hello" }]
      })).resolves.toMatchObject({
        runId: "run-1",
        sessionId: "session-1"
      });
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
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

  it("projects the app-facing client without exposing host-only namespaces", () => {
    const hostClient = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667"
    });
    const appClient = createNextClawAppClient(hostClient);

    expect(Object.keys(appClient).sort()).toEqual([
      "agentRuns",
      "agents",
      "assets",
      "events",
      "serviceActions",
      "sessions"
    ]);
    expect("config" in appClient).toBe(false);
    expect("eventBus" in appClient).toBe(false);
    expect("panelApps" in appClient).toBe(false);
    expect("runtimeControl" in appClient).toBe(false);
    expect("serviceApps" in appClient).toBe(false);
    expect(appClient.sessions.list).toBe(hostClient.sessions.list);
    expect(appClient.agents.resolveAvatarUrl).toBe(hostClient.agents.resolveAvatarUrl);
    expect(appClient.agentRuns.send).toBe(hostClient.agentRuns.send);
    expect(appClient.agentRuns.stream).toBe(hostClient.agentRuns.stream);
    expect(appClient.agentRuns.abort).toBe(hostClient.agentRuns.abort);
    expect(appClient.serviceActions.list).toBe(hostClient.serviceApps.listServiceActions);
    expect(appClient.serviceActions.invoke).toBe(hostClient.serviceApps.invokeServiceAction);
    expect(appClient.assets.upload).toBe(hostClient.sessions.uploadAssets);
    expect(appClient.events.subscribe).toBe(hostClient.realtime.subscribe);
  });

  it("uses host client methods through the app-facing projection", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            sessions: [],
            total: 0
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    const hostClient = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      fetchImpl
    });
    const appClient = createNextClawAppClient(hostClient);

    await expect(appClient.sessions.list()).resolves.toEqual({
      sessions: [],
      total: 0
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:55667/api/ncp/sessions",
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

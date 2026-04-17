import { describe, expect, it } from "vitest";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import {
  HttpRuntimeConfigResolver,
  HttpRuntimeNcpAgentRuntime,
} from "./index.js";

function sseFrame(data: unknown): string {
  return `event: ncp-event\ndata: ${JSON.stringify(data)}\n\n`;
}

function createSseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const frame of frames) {
          controller.enqueue(encoder.encode(frame));
        }
        controller.close();
      },
    }),
    {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
      },
    },
  );
}

function createDelayedTerminalSseResponse(
  frames: string[],
  options: { closeDelayMs: number; signal?: AbortSignal },
): Response {
  const encoder = new TextEncoder();
  let closed = false;

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const frame of frames) {
          controller.enqueue(encoder.encode(frame));
        }
        const timeout = setTimeout(() => {
          closed = true;
          controller.close();
        }, options.closeDelayMs);

        options.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timeout);
            if (!closed) {
              // Simulate the Node fetch behavior we hit in real smoke:
              // terminal frames are delivered, but aborting the active
              // response body prevents the stream promise from settling.
              return;
            }
            controller.close();
          },
          { once: true },
        );
      },
    }),
    {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
      },
    },
  );
}

describe("HttpRuntimeConfigResolver", () => {
  it("normalizes wildcard supportedModels to unrestricted", () => {
    const resolver = new HttpRuntimeConfigResolver({
      baseUrl: "http://127.0.0.1:8123",
      supportedModels: ["*"],
    });

    expect(
      resolver.resolve({
        defaultModel: "openai/gpt-5.4",
      }),
    ).toEqual(
      expect.objectContaining({
        baseUrl: "http://127.0.0.1:8123",
        supportedModels: undefined,
        recommendedModel: "openai/gpt-5.4",
      }),
    );
  });
});

describe("HttpRuntimeNcpAgentRuntime", () => {
  it("bridges remote HTTP endpoint events into the runtime stream", async () => {
    const calls: string[] = [];
    const sendBodies: Array<Record<string, unknown>> = [];
    const runtime = new HttpRuntimeNcpAgentRuntime({
      baseUrl: "https://adapter.example.com",
      resolveTools: () => [
        {
          type: "function",
          function: {
            name: "list_dir",
            description: "List files",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        },
      ],
      resolveProviderRoute: () => ({
        model: "MiniMax-M2.7",
        apiKey: "minimax-key",
        apiBase: "https://api.minimax.chat/v1",
        headers: {
          "x-minimax-group-id": "test-group",
        },
      }),
      fetchImpl: async (input, init) => {
        const url = input instanceof URL ? input : new URL(String(input));
        calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
        if (url.pathname === "/ncp/agent/send") {
          sendBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.pathname === "/ncp/agent/stream") {
          return createSseResponse([
            sseFrame({
              type: NcpEventType.RunStarted,
              payload: {
                sessionId: "session-http-runtime",
                messageId: "assistant-1",
                runId: "run-1",
              },
            }),
            sseFrame({
              type: NcpEventType.MessageTextStart,
              payload: {
                sessionId: "session-http-runtime",
                messageId: "assistant-1",
              },
            }),
            sseFrame({
              type: NcpEventType.MessageTextDelta,
              payload: {
                sessionId: "session-http-runtime",
                messageId: "assistant-1",
                delta: "hello over http runtime",
              },
            }),
            sseFrame({
              type: NcpEventType.MessageTextEnd,
              payload: {
                sessionId: "session-http-runtime",
                messageId: "assistant-1",
              },
            }),
            sseFrame({
              type: NcpEventType.MessageCompleted,
              payload: {
                sessionId: "session-http-runtime",
                message: {
                  id: "assistant-1",
                  sessionId: "session-http-runtime",
                  role: "assistant",
                  status: "final",
                  timestamp: "2026-04-15T00:00:00.000Z",
                  parts: [{ type: "text", text: "hello over http runtime" }],
                },
              },
            }),
            sseFrame({
              type: NcpEventType.RunFinished,
              payload: {
                sessionId: "session-http-runtime",
                messageId: "assistant-1",
                runId: "run-1",
              },
            }),
          ]);
        }
        if (url.pathname === "/ncp/agent/abort") {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`unexpected request: ${url.pathname}`);
      },
    });

    const events: NcpEndpointEvent[] = [];
    for await (const event of runtime.run({
      sessionId: "session-http-runtime",
      messages: [
        {
          id: "user-1",
          sessionId: "session-http-runtime",
          role: "user",
          status: "final",
          timestamp: "2026-04-15T00:00:00.000Z",
          parts: [{ type: "text", text: "ping" }],
        },
      ],
    })) {
      events.push(event);
    }

    expect(calls).toEqual([
      "GET /ncp/agent/stream",
      "POST /ncp/agent/send",
    ]);
    expect(
      ((sendBodies[0]?.tools as Array<{ function?: { name?: string } }> | undefined) ?? [])
        .map((tool) => tool.function?.name),
    ).toContain("list_dir");
    expect(sendBodies[0]?.providerRoute).toEqual({
      model: "MiniMax-M2.7",
      apiKey: "minimax-key",
      apiBase: "https://api.minimax.chat/v1",
      headers: {
        "x-minimax-group-id": "test-group",
      },
    });
    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.RunStarted,
      NcpEventType.MessageTextStart,
      NcpEventType.MessageTextDelta,
      NcpEventType.MessageTextEnd,
      NcpEventType.MessageCompleted,
      NcpEventType.RunFinished,
    ]);
  });

  it("waits for the remote stream to close naturally after terminal events", async () => {
    const runtime = new HttpRuntimeNcpAgentRuntime({
      baseUrl: "https://adapter.example.com",
      fetchImpl: async (input, init) => {
        const url = input instanceof URL ? input : new URL(String(input));
        if (url.pathname === "/ncp/agent/send") {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.pathname === "/ncp/agent/stream") {
          return createDelayedTerminalSseResponse(
            [
              sseFrame({
                type: NcpEventType.RunStarted,
                payload: {
                  sessionId: "session-http-runtime-delayed-close",
                  messageId: "assistant-1",
                  runId: "run-1",
                },
              }),
              sseFrame({
                type: NcpEventType.MessageCompleted,
                payload: {
                  sessionId: "session-http-runtime-delayed-close",
                  message: {
                    id: "assistant-1",
                    sessionId: "session-http-runtime-delayed-close",
                    role: "assistant",
                    status: "final",
                    timestamp: "2026-04-15T00:00:00.000Z",
                    parts: [{ type: "text", text: "OK" }],
                  },
                },
              }),
              sseFrame({
                type: NcpEventType.RunFinished,
                payload: {
                  sessionId: "session-http-runtime-delayed-close",
                  messageId: "assistant-1",
                  runId: "run-1",
                },
              }),
            ],
            {
              closeDelayMs: 10,
              signal:
                init?.signal instanceof AbortSignal ? init.signal : undefined,
            },
          );
        }
        if (url.pathname === "/ncp/agent/abort") {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error(`unexpected request: ${url.pathname}`);
      },
    });

    const events: NcpEndpointEvent[] = [];
    for await (const event of runtime.run({
      sessionId: "session-http-runtime-delayed-close",
      messages: [
        {
          id: "user-1",
          sessionId: "session-http-runtime-delayed-close",
          role: "user",
          status: "final",
          timestamp: "2026-04-15T00:00:00.000Z",
          parts: [{ type: "text", text: "ping" }],
        },
      ],
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.RunStarted,
      NcpEventType.MessageCompleted,
      NcpEventType.RunFinished,
    ]);
  });
});

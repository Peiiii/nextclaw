import { describe, expect, it } from "vitest";
import type { NcpEndpointEvent, NcpRequestEnvelope } from "@nextclaw/ncp";
import { createNcpHttpAgentClient } from "./index.js";

const now = "2026-03-12T00:00:00.000Z";

describe("createNcpHttpAgentClient stream behavior", () => {
  it("preserves utf-8 delta when multibyte character is split across chunks", async () => {
    const calls: Array<{ input: URL | string | Request; init?: RequestInit }> = [];
    const frames = [
      sseFrame("ncp-event", {
        type: "message.text-delta",
        payload: { sessionId: "session-1", messageId: "assistant-1", delta: "你" },
      }),
      sseFrame("ncp-event", {
        type: "message.completed",
        payload: {
          sessionId: "session-1",
          message: {
            id: "assistant-1",
            sessionId: "session-1",
            role: "assistant",
            status: "final",
            parts: [{ type: "text", text: "你" }],
            timestamp: now,
          },
        },
      }),
    ];

    const fetchImpl = async (input: URL | string | Request, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      return createSseResponse(frames, { splitByUtf8Token: "你" });
    };

    const client = createNcpHttpAgentClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
    });

    const received: NcpEndpointEvent[] = [];
    client.subscribe((event) => {
      received.push(event);
    });

    await client.send({
      sessionId: "session-1",
      message: {
        id: "user-1",
        sessionId: "session-1",
        role: "user",
        status: "final",
        parts: [{ type: "text", text: "ping" }],
        timestamp: now,
      },
    });

    expect(calls).toHaveLength(1);
    const deltaEvent = received.find((event) => event.type === "message.text-delta");
    expect(deltaEvent?.type).toBe("message.text-delta");
    if (deltaEvent?.type === "message.text-delta") {
      expect(deltaEvent.payload.delta).toBe("你");
    }
  });

  it("streams ncp events from /send and notifies subscribers", async () => {
    const calls: Array<{ input: URL | string | Request; init?: RequestInit }> = [];
    const fetchImpl = async (input: URL | string | Request, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      return createSseResponse([
        sseFrame("ncp-event", {
          type: "message.accepted",
          payload: { messageId: "assistant-1", correlationId: "corr-1" },
        }),
        sseFrame("ncp-event", {
          type: "message.text-delta",
          payload: { sessionId: "session-1", messageId: "assistant-1", delta: "hello" },
        }),
        sseFrame("ncp-event", {
          type: "message.completed",
          payload: {
            sessionId: "session-1",
            correlationId: "corr-1",
            message: {
              id: "assistant-1",
              sessionId: "session-1",
              role: "assistant",
              status: "final",
              parts: [{ type: "text", text: "hello" }],
              timestamp: now,
            },
          },
        }),
      ]);
    };

    const client = createNcpHttpAgentClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
    });

    const received: NcpEndpointEvent[] = [];
    client.subscribe((event) => {
      received.push(event);
    });

    const envelope: NcpRequestEnvelope = {
      sessionId: "session-1",
      correlationId: "corr-1",
      message: {
        id: "user-1",
        sessionId: "session-1",
        role: "user",
        status: "final",
        parts: [{ type: "text", text: "ping" }],
        timestamp: now,
      },
    };

    await client.send(envelope);

    expect(calls).toHaveLength(1);
    const requestUrl = calls[0]?.input instanceof URL ? calls[0].input : new URL(String(calls[0]?.input));
    expect(requestUrl.pathname).toBe("/ncp/agent/send");
    expect(calls[0]?.init?.method).toBe("POST");

    const eventTypes = received.map((event) => event.type);
    expect(eventTypes).toEqual([
      "endpoint.ready",
      "message.accepted",
      "message.text-delta",
      "message.completed",
    ]);
  });

});

describe("createNcpHttpAgentClient resume and abort", () => {
  it("resume builds reconnect query and maps SSE error to endpoint.error", async () => {
    const calls: Array<{ input: URL | string | Request; init?: RequestInit }> = [];
    const fetchImpl = async (input: URL | string | Request, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      return createSseResponse([
        sseFrame("error", {
          code: "TIMEOUT",
          message: "resume timeout",
        }),
      ]);
    };

    const client = createNcpHttpAgentClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
    });

    const received: NcpEndpointEvent[] = [];
    client.subscribe((event) => {
      received.push(event);
    });

    await expect(
      client.resume({
        sessionId: "session-1",
        remoteRunId: "run-1",
        fromEventIndex: 7,
      }),
    ).rejects.toThrow("resume timeout");

    expect(calls).toHaveLength(1);
    const requestUrl = calls[0]?.input instanceof URL ? calls[0].input : new URL(String(calls[0]?.input));
    expect(requestUrl.pathname).toBe("/ncp/agent/reconnect");
    expect(requestUrl.searchParams.get("sessionId")).toBe("session-1");
    expect(requestUrl.searchParams.get("remoteRunId")).toBe("run-1");
    expect(requestUrl.searchParams.get("fromEventIndex")).toBe("7");
    expect(calls[0]?.init?.method).toBe("GET");

    const endpointErrors = received.filter((event) => event.type === "endpoint.error");
    expect(endpointErrors).toHaveLength(1);
    const endpointError = endpointErrors[0];
    expect(endpointError?.type).toBe("endpoint.error");
    if (endpointError && endpointError.type === "endpoint.error") {
      expect(endpointError.payload.code).toBe("timeout-error");
      expect(endpointError.payload.message).toBe("resume timeout");
    }
  });

  it("abort sends payload to /abort", async () => {
    const calls: Array<{ input: URL | string | Request; init?: RequestInit }> = [];
    const fetchImpl = async (input: URL | string | Request, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = createNcpHttpAgentClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
    });

    await client.abort({ runId: "run-9" });

    expect(calls).toHaveLength(1);
    const requestUrl = calls[0]?.input instanceof URL ? calls[0].input : new URL(String(calls[0]?.input));
    expect(requestUrl.pathname).toBe("/ncp/agent/abort");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ runId: "run-9" }));
  });

});

describe("createNcpHttpAgentClient edge cases", () => {
  it("does not publish endpoint.error when stop aborts in-flight abort request", async () => {
    const fetchImpl = async (_input: URL | string | Request, init?: RequestInit): Promise<Response> => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        if (!signal) {
          reject(new Error("Missing abort signal in fetch request."));
          return;
        }
        if (signal.aborted) {
          const error = new Error("Abort request cancelled.");
          error.name = "AbortError";
          reject(error);
          return;
        }
        signal.addEventListener(
          "abort",
          () => {
            const error = new Error("Abort request cancelled.");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      });
    };

    const client = createNcpHttpAgentClient({
      baseUrl: "https://api.example.com",
      fetchImpl,
    });

    const received: NcpEndpointEvent[] = [];
    client.subscribe((event) => {
      received.push(event);
    });

    const abortPromise = client.abort({ runId: "run-11" });
    await Promise.resolve();
    await Promise.resolve();
    await client.stop();
    await expect(abortPromise).resolves.toBeUndefined();

    const endpointErrors = received.filter((event) => event.type === "endpoint.error");
    expect(endpointErrors).toHaveLength(0);
  });
});

function sseFrame(eventName: string, data: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

function createSseResponse(
  frames: string[],
  options: { splitAt?: number; splitByUtf8Token?: string } = {},
): Response {
  const payload = frames.join("");
  const encoder = new TextEncoder();
  const bytes = encoder.encode(payload);
  const splitAt =
    options.splitAt ??
    (options.splitByUtf8Token ? findSplitInsideToken(bytes, options.splitByUtf8Token) : Math.max(1, Math.floor(bytes.length / 2)));
  const safeSplitAt = Math.max(1, Math.min(splitAt, bytes.length - 1));
  const first = bytes.slice(0, safeSplitAt);
  const second = bytes.slice(safeSplitAt);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(first);
      controller.enqueue(second);
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
    },
  });
}

function findSplitInsideToken(bytes: Uint8Array, token: string): number {
  const tokenBytes = new TextEncoder().encode(token);
  if (tokenBytes.length < 2) {
    return Math.max(1, Math.floor(bytes.length / 2));
  }
  const start = findSequenceStart(bytes, tokenBytes);
  if (start < 0) {
    return Math.max(1, Math.floor(bytes.length / 2));
  }
  return start + 1;
}

function findSequenceStart(haystack: Uint8Array, needle: Uint8Array): number {
  for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    let matched = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return i;
    }
  }
  return -1;
}

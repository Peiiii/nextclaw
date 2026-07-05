import { describe, expect, it } from "vitest";
import {
  type NcpAgentClientEndpoint,
  type NcpAgentSendEnvelope,
  type NcpEndpointEvent,
  type NcpEndpointManifest,
  type NcpEndpointSubscriber,
  type NcpMessageAbortPayload,
  type NcpRequestEnvelope,
  type NcpStreamRequestPayload,
  NcpEventType,
} from "@nextclaw/ncp";
import { createNcpHttpAgentRouter } from "../index.js";
import { sanitizeTimeout } from "../request-parsers.utils.js";

const now = "2026-03-12T00:00:00.000Z";

describe("createNcpHttpAgentRouter", () => {
  it("forwards /send request to endpoint and returns json ack", async () => {
    const endpoint = new FakeAgentEndpoint();
    const app = createNcpHttpAgentRouter({ agentClientEndpoint: endpoint });

    const requestBody: NcpRequestEnvelope = {
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

    const response = await app.request("http://localhost/ncp/agent/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        sessionId: "session-1",
        userMessageId: "user-1",
        assistantMessageId: null,
        runId: null,
        correlationId: "corr-1",
      },
    });

    expect(endpoint.emitted[0]?.type).toBe("message.request");
  });

  it("accepts a new-session /send command without session id", async () => {
    const endpoint = new FakeAgentEndpoint();
    const app = createNcpHttpAgentRouter({ agentClientEndpoint: endpoint });
    const requestBody: NcpAgentSendEnvelope = {
      message: {
        id: "user-new-session",
        role: "user",
        status: "final",
        parts: [{ type: "text", text: "ping" }],
        timestamp: now,
      },
      metadata: { session_type: "native", agent_id: "main" },
    };

    const response = await app.request("http://localhost/ncp/agent/send", {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        sessionId: "session-created",
        userMessageId: "user-new-session",
        assistantMessageId: null,
        runId: null,
      },
    });
    expect(endpoint.emitted[0]).toEqual({
      type: NcpEventType.MessageRequest,
      payload: requestBody,
    });
  });

  it("returns 400 when stream query is missing required fields", async () => {
    const endpoint = new FakeAgentEndpoint();
    const app = createNcpHttpAgentRouter({ agentClientEndpoint: endpoint });

    const response = await app.request("http://localhost/ncp/agent/stream", {
      method: "GET",
    });
    expect(response.status).toBe(400);
  });

  it("closes /stream immediately when no live session is available", async () => {
    const endpoint = new FakeAgentEndpoint();
    const app = createNcpHttpAgentRouter({ agentClientEndpoint: endpoint });

    const response = await app.request(
      "http://localhost/ncp/agent/stream?sessionId=session-1",
      {
        method: "GET",
      },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(endpoint.emitted).toEqual([
      expect.objectContaining({
        type: NcpEventType.MessageStreamRequest,
        payload: { sessionId: "session-1" },
      }),
    ]);
  });

  it("keeps /stream open across terminal-looking events when using streamProvider", async () => {
    const app = createNcpHttpAgentRouter({
      agentClientEndpoint: new FakeAgentEndpoint(),
      streamProvider: {
        async *stream() {
          yield {
            type: NcpEventType.RunFinished,
            payload: { sessionId: "session-1", runId: "run-1" },
          };
          yield {
            type: NcpEventType.MessageToolCallResult,
            payload: {
              sessionId: "session-1",
              toolCallId: "tool-1",
              content: { ok: true },
            },
          };
        },
      },
    });

    const response = await app.request(
      "http://localhost/ncp/agent/stream?sessionId=session-1",
      {
        method: "GET",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('"type":"run.finished"');
    expect(body).toContain('"type":"message.tool-call-result"');
  });

  it("forwards /abort payload to endpoint", async () => {
    const endpoint = new FakeAgentEndpoint();
    const app = createNcpHttpAgentRouter({ agentClientEndpoint: endpoint });

    const response = await app.request("http://localhost/ncp/agent/abort", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        messageId: "assistant-1",
        runId: "run-1",
        correlationId: "correlation-1",
        reason: {
          code: "abort-error",
          message: "用户停止了当前运行。",
          details: { source: "chat-ui" },
        },
      }),
    });

    expect(response.status).toBe(200);
    const abortEvent = endpoint.emitted.find(
      (event) => event.type === NcpEventType.MessageAbort,
    );
    expect(abortEvent).toEqual({
      type: NcpEventType.MessageAbort,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        runId: "run-1",
        correlationId: "correlation-1",
        reason: {
          code: "abort-error",
          message: "用户停止了当前运行。",
          details: { source: "chat-ui" },
        },
      },
    });
  });
});

describe("sanitizeTimeout", () => {
  it("disables timeout by default", () => {
    expect(sanitizeTimeout(undefined)).toBeNull();
    expect(sanitizeTimeout(null)).toBeNull();
    expect(sanitizeTimeout(0)).toBeNull();
    expect(sanitizeTimeout(-1)).toBeNull();
  });

  it("keeps explicit timeout support", () => {
    expect(sanitizeTimeout(1_500)).toBe(1_500);
    expect(sanitizeTimeout(200)).toBe(1_000);
  });
});

class FakeAgentEndpoint implements NcpAgentClientEndpoint {
  readonly manifest: NcpEndpointManifest = {
    endpointKind: "agent",
    endpointId: "fake-agent",
    version: "0.1.0",
    supportsStreaming: true,
    supportsAbort: true,
    supportsProactiveMessages: false,
    supportsLiveSessionStream: true,
    supportedPartTypes: ["text"],
    expectedLatency: "seconds",
  };

  private readonly listeners = new Set<NcpEndpointSubscriber>();
  readonly emitted: NcpEndpointEvent[] = [];

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  async emit(event: NcpEndpointEvent): Promise<void> {
    this.emitted.push(event);
  }

  subscribe(listener: NcpEndpointSubscriber): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async send(envelope: NcpAgentSendEnvelope) {
    await this.emit({ type: NcpEventType.MessageRequest, payload: envelope });
    const sessionId = envelope.sessionId ?? envelope.message.sessionId ?? "session-created";
    return {
      sessionId,
      userMessageId: envelope.message.id,
      assistantMessageId: null,
      runId: null,
      ...(envelope.correlationId ? { correlationId: envelope.correlationId } : {}),
    };
  }

  async stream(payload: NcpStreamRequestPayload): Promise<void> {
    await this.emit({ type: NcpEventType.MessageStreamRequest, payload });
  }

  async abort(payload: NcpMessageAbortPayload): Promise<void> {
    await this.emit({ type: NcpEventType.MessageAbort, payload });
  }
}

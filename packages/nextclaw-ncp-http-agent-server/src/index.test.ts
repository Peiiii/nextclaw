import { describe, expect, it } from "vitest";
import type {
  NcpAgentServerEndpoint,
  NcpEndpointEvent,
  NcpEndpointManifest,
  NcpEndpointSubscriber,
  NcpRequestEnvelope,
} from "@nextclaw/ncp";
import { createNcpHttpAgentRouter } from "./index.js";

const now = "2026-03-12T00:00:00.000Z";

describe("createNcpHttpAgentRouter", () => {
  it("forwards /send request to endpoint and streams scoped events", async () => {
    const endpoint = new FakeAgentEndpoint();
    const app = createNcpHttpAgentRouter({ agentEndpoint: endpoint });

    endpoint.setEmitHandler((event) => {
      if (event.type !== "message.request") {
        return;
      }
      const { sessionId, correlationId } = event.payload;
      endpoint.push({
        type: "message.accepted",
        payload: { messageId: "assistant-1", correlationId },
      });
      endpoint.push({
        type: "message.text-delta",
        payload: { sessionId: "other-session", messageId: "assistant-1", delta: "ignored" },
      });
      endpoint.push({
        type: "message.completed",
        payload: {
          sessionId,
          correlationId,
          message: {
            id: "assistant-1",
            sessionId,
            role: "assistant",
            status: "final",
            parts: [{ type: "text", text: "ok" }],
            timestamp: now,
          },
        },
      });
    });

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
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const body = await response.text();
    expect(body).toContain('"type":"message.accepted"');
    expect(body).toContain('"type":"message.completed"');
    expect(body).not.toContain('"other-session"');

    expect(endpoint.emitted[0]?.type).toBe("message.request");
  });

  it("returns 400 when reconnect query is missing required fields", async () => {
    const endpoint = new FakeAgentEndpoint();
    const app = createNcpHttpAgentRouter({ agentEndpoint: endpoint });

    const response = await app.request("http://localhost/ncp/agent/reconnect?sessionId=session-1", {
      method: "GET",
    });
    expect(response.status).toBe(400);
  });

  it("forwards /abort payload to endpoint", async () => {
    const endpoint = new FakeAgentEndpoint();
    const app = createNcpHttpAgentRouter({ agentEndpoint: endpoint });

    const response = await app.request("http://localhost/ncp/agent/abort", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: "run-1" }),
    });

    expect(response.status).toBe(200);
    const abortEvent = endpoint.emitted.find((event) => event.type === "message.abort");
    expect(abortEvent).toEqual({
      type: "message.abort",
      payload: { runId: "run-1" },
    });
  });
});

class FakeAgentEndpoint implements NcpAgentServerEndpoint {
  readonly manifest: NcpEndpointManifest & { endpointKind: "agent" } = {
    endpointKind: "agent",
    endpointId: "fake-agent",
    version: "0.1.0",
    supportsStreaming: true,
    supportsAbort: true,
    supportsProactiveMessages: false,
    supportsSessionResume: true,
    supportedPartTypes: ["text"],
    expectedLatency: "seconds",
  };

  private readonly listeners = new Set<NcpEndpointSubscriber>();
  private emitHandler: ((event: NcpEndpointEvent) => void) | null = null;
  readonly emitted: NcpEndpointEvent[] = [];

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  async emit(event: NcpEndpointEvent): Promise<void> {
    this.emitted.push(event);
    if (this.emitHandler) {
      this.emitHandler(event);
    }
  }

  subscribe(listener: NcpEndpointSubscriber): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setEmitHandler(handler: (event: NcpEndpointEvent) => void): void {
    this.emitHandler = handler;
  }

  push(event: NcpEndpointEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

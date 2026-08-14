import { describe, expect, it, vi } from "vitest";
import {
  type NcpAgentServerEndpoint,
  type NcpEndpointEvent,
  type NcpEndpointManifest,
  type NcpEndpointSubscriber,
  type NcpMessageAbortPayload,
  type NcpRequestEnvelope,
  type NcpStreamRequestPayload,
  NcpEventType,
} from "@nextclaw/ncp";
import { createAgentClientFromServer } from "./agent-client-from-server.js";

const now = "2026-03-15T00:00:00.000Z";

describe("createAgentClientFromServer", () => {
  it("routes send/stream/abort to server methods", async () => {
    const server = new FakeServerEndpoint();
    const client = createAgentClientFromServer(server);
    const onOpen = vi.fn();

    await client.send(createEnvelope("hello"));
    await client.stream({ sessionId: "session-1" }, { onOpen });
    await client.abort({ sessionId: "session-1" });

    expect(server.sendCalls).toHaveLength(1);
    expect(server.streamCalls).toHaveLength(1);
    expect(server.abortCalls).toEqual([{ sessionId: "session-1" }]);
    expect(server.sendIteratorConsumed).toBe(1);
    expect(server.streamIteratorConsumed).toBe(1);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("routes request-like emit events to server request methods", async () => {
    const server = new FakeServerEndpoint();
    const client = createAgentClientFromServer(server);
    const envelope = createEnvelope("ping");

    await client.emit({ type: NcpEventType.MessageRequest, payload: envelope });
    await client.emit({
      type: NcpEventType.MessageStreamRequest,
      payload: { sessionId: "session-1" },
    });
    await client.emit({ type: NcpEventType.MessageAbort, payload: { sessionId: "session-1" } });

    expect(server.sendCalls).toEqual([envelope]);
    expect(server.streamCalls).toEqual([{ sessionId: "session-1" }]);
    expect(server.abortCalls).toEqual([{ sessionId: "session-1" }]);
    expect(server.emitCalls).toHaveLength(0);
  });

  it("forwards non-request emit events as downstream publish", async () => {
    const server = new FakeServerEndpoint();
    const client = createAgentClientFromServer(server);
    const event: NcpEndpointEvent = {
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId: "session-1",
        message: {
          id: "assistant-1",
          sessionId: "session-1",
          role: "assistant",
          status: "final",
          parts: [{ type: "text", text: "done" }],
          timestamp: now,
        },
      },
    };

    await client.emit(event);

    expect(server.emitCalls).toEqual([event]);
  });

});

class FakeServerEndpoint implements NcpAgentServerEndpoint {
  readonly manifest: NcpEndpointManifest & { endpointKind: "agent" } = {
    endpointKind: "agent",
    endpointId: "fake-server",
    version: "0.1.0",
    supportsStreaming: true,
    supportsAbort: true,
    supportsProactiveMessages: false,
    supportsLiveSessionStream: true,
    supportedPartTypes: ["text"],
    expectedLatency: "seconds",
  };

  readonly sendCalls: NcpRequestEnvelope[] = [];
  readonly streamCalls: NcpStreamRequestPayload[] = [];
  readonly abortCalls: NcpMessageAbortPayload[] = [];
  readonly emitCalls: NcpEndpointEvent[] = [];
  sendIteratorConsumed = 0;
  streamIteratorConsumed = 0;
  private readonly listeners = new Set<NcpEndpointSubscriber>();

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  async *send(
    envelope: NcpRequestEnvelope,
  ): AsyncIterable<NcpEndpointEvent> {
    this.sendCalls.push(envelope);
    this.sendIteratorConsumed += 1;
    yield {
      type: NcpEventType.MessageAccepted,
      payload: { messageId: "assistant-1" },
    };
  }

  async *stream(
    payload: NcpStreamRequestPayload,
  ): AsyncIterable<NcpEndpointEvent> {
    this.streamCalls.push(payload);
    this.streamIteratorConsumed += 1;
    yield {
      type: NcpEventType.RunFinished,
      payload: { sessionId: payload.sessionId, runId: "run-from-stream" },
    };
  }

  async abort(payload: NcpMessageAbortPayload): Promise<void> {
    this.abortCalls.push(payload);
  }

  async emit(event: NcpEndpointEvent): Promise<void> {
    this.emitCalls.push(event);
  }

  subscribe(listener: NcpEndpointSubscriber): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

function createEnvelope(text: string): NcpRequestEnvelope {
  return {
    sessionId: "session-1",
    correlationId: "corr-1",
    message: {
      id: "user-1",
      sessionId: "session-1",
      role: "user",
      status: "final",
      parts: [{ type: "text", text }],
      timestamp: now,
    },
  };
}

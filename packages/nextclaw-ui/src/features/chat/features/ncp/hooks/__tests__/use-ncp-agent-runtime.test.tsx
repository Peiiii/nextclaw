import { act, renderHook, waitFor } from "@testing-library/react";
import {
  type NcpAgentClientEndpoint,
  type NcpAgentSendEnvelope,
  type NcpEndpointEvent,
  type NcpEndpointManifest,
  type NcpEndpointSubscriber,
  type NcpMessage,
  type NcpStreamRequestPayload,
  NcpEventType,
} from "@nextclaw/ncp";
import { useNcpAgentRuntime } from "@nextclaw/ncp-react";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const now = "2026-05-14T00:00:00.000Z";

class DeferredSendClient implements NcpAgentClientEndpoint {
  readonly manifest: NcpEndpointManifest = {
    endpointKind: "agent",
    endpointId: "deferred-send-client",
    version: "0.1.0",
    supportsStreaming: true,
    supportsAbort: true,
    supportsProactiveMessages: false,
    supportsLiveSessionStream: true,
    supportedPartTypes: ["text"],
    expectedLatency: "seconds",
  };

  readonly stop = vi.fn(async () => {});
  readonly start = vi.fn(async () => {});
  readonly stream = vi.fn(async () => {});
  readonly abort = vi.fn(async () => {});
  private listeners = new Set<NcpEndpointSubscriber>();

  emit = async (event: NcpEndpointEvent): Promise<void> => {
    this.publish(event);
  };

  subscribe = (listener: NcpEndpointSubscriber): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  send = vi.fn(async (envelope: NcpAgentSendEnvelope) => ({
    sessionId: "session-created",
    userMessageId: envelope.message.id,
    assistantMessageId: "assistant-1",
    runId: "run-1",
    ...(envelope.correlationId ? { correlationId: envelope.correlationId } : {}),
  }));

  private publish = (event: NcpEndpointEvent): void => {
    for (const listener of this.listeners) {
      listener(event);
    }
  };
}

class ExistingSessionLiveClient implements NcpAgentClientEndpoint {
  readonly manifest: NcpEndpointManifest = {
    endpointKind: "agent",
    endpointId: "existing-session-live-client",
    version: "0.1.0",
    supportsStreaming: true,
    supportsAbort: true,
    supportsProactiveMessages: false,
    supportsLiveSessionStream: true,
    supportedPartTypes: ["text"],
    expectedLatency: "seconds",
  };

  readonly start = vi.fn(async () => {});
  readonly abort = vi.fn(async () => {});
  private listeners = new Set<NcpEndpointSubscriber>();
  private liveStreamActive = false;

  stop = vi.fn(async () => {
    this.liveStreamActive = false;
  });

  stream = vi.fn(async (_payload: NcpStreamRequestPayload) => {
    this.liveStreamActive = true;
  });

  emit = async (event: NcpEndpointEvent): Promise<void> => {
    this.publish(event);
  };

  subscribe = (listener: NcpEndpointSubscriber): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  send = vi.fn(async (envelope: NcpAgentSendEnvelope) => {
    const events: NcpEndpointEvent[] = [
      {
        type: NcpEventType.RunStarted,
        payload: {
          sessionId: "session-existing",
          messageId: "assistant-1",
          runId: "run-1",
        },
      },
      {
        type: NcpEventType.MessageTextStart,
        payload: {
          sessionId: "session-existing",
          messageId: "assistant-1",
        },
      },
      {
        type: NcpEventType.MessageTextDelta,
        payload: {
          sessionId: "session-existing",
          messageId: "assistant-1",
          delta: "done",
        },
      },
      {
        type: NcpEventType.MessageTextEnd,
        payload: {
          sessionId: "session-existing",
          messageId: "assistant-1",
        },
      },
      {
        type: NcpEventType.RunFinished,
        payload: {
          sessionId: "session-existing",
          runId: "run-1",
        },
      },
    ];

    if (this.liveStreamActive) {
      for (const event of events) {
        this.publish(event);
      }
    }
    return {
      sessionId: "session-existing",
      userMessageId: envelope.message.id,
      assistantMessageId: "assistant-1",
      runId: "run-1",
    };
  });

  private publish = (event: NcpEndpointEvent): void => {
    for (const listener of this.listeners) {
      listener(event);
    }
  };
}

function readAssistantText(messages: readonly NcpMessage[]): string {
  const assistant = messages.find((message) => message.role === "assistant");
  return assistant?.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("") ?? "";
}

describe("useNcpAgentRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a command handle when a new root chat materializes a session id", async () => {
    const client = new DeferredSendClient();
    const manager = new DefaultNcpAgentConversationStateManager();
    const envelope: NcpAgentSendEnvelope = {
      message: {
        id: "user-1",
        role: "user",
        status: "final",
        parts: [{ type: "text", text: "hello" }],
        timestamp: now,
      },
    };
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId?: string }) =>
        useNcpAgentRuntime({ sessionId, client, manager: manager as never }),
      { initialProps: { sessionId: undefined as string | undefined } },
    );

    let handle: Awaited<ReturnType<typeof result.current.send>> | null = null;
    await act(async () => {
      handle = await result.current.send(envelope);
    });

    expect(handle).toEqual({
      sessionId: "session-created",
      userMessageId: "user-1",
      assistantMessageId: "assistant-1",
      runId: "run-1",
    });
    expect(result.current.visibleMessages).toEqual([]);
    expect(client.stop).not.toHaveBeenCalled();

    rerender({ sessionId: "session-created" });
  });

  it("aborts by session id even before a hydrated active run reaches local state", async () => {
    const client = new DeferredSendClient();
    const manager = new DefaultNcpAgentConversationStateManager();
    const { result } = renderHook(() =>
      useNcpAgentRuntime({ sessionId: "session-running", client, manager: manager as never }),
    );

    await act(async () => {
      await result.current.abort();
    });

    expect(client.abort).toHaveBeenCalledWith({ sessionId: "session-running" });
  });

  it("uses the hydrated live stream as the only event source while sending to an existing session", async () => {
    const client = new ExistingSessionLiveClient();
    const manager = new DefaultNcpAgentConversationStateManager();
    await client.stream({ sessionId: "session-existing" });
    const { result } = renderHook(() =>
      useNcpAgentRuntime({ sessionId: "session-existing", client, manager: manager as never }),
    );

    await act(async () => {
      await result.current.send({
        sessionId: "session-existing",
        message: {
          id: "user-1",
          sessionId: "session-existing",
          role: "user",
          status: "final",
          parts: [{ type: "text", text: "hello" }],
          timestamp: now,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.snapshot.activeRun).toBeNull();
      expect(readAssistantText(result.current.visibleMessages)).toBe("done");
    });
    expect(client.stop).not.toHaveBeenCalled();
    expect(client.stream).toHaveBeenCalledTimes(1);
  });
});

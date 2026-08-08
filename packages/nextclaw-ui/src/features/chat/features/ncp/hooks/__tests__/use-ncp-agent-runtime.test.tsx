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

  it("keeps an accepted run active while a new root chat materializes", async () => {
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
    expect(result.current.visibleMessages).toEqual([
      expect.objectContaining({
        ...envelope.message,
        sessionId: "session-created",
      }),
    ]);
    expect(result.current.isRunning).toBe(true);
    expect(client.stop).not.toHaveBeenCalled();

    rerender({ sessionId: "session-created" });
    expect(result.current.isRunning).toBe(true);

    await act(async () => {
      await client.emit({
        type: NcpEventType.RunStarted,
        payload: {
          sessionId: "session-created",
          runId: "run-1",
        },
      });
    });
    await waitFor(() => {
      expect(result.current.isRunning).toBe(true);
    });

    await act(async () => {
      await client.emit({
        type: NcpEventType.RunFinished,
        payload: {
          sessionId: "session-created",
          runId: "run-1",
        },
      });
    });
    await waitFor(() => {
      expect(result.current.isRunning).toBe(false);
    });
  });

  it("shows a preallocated draft message before send returns and keeps it through materialization", async () => {
    const client = new DeferredSendClient();
    const manager = new DefaultNcpAgentConversationStateManager();
    const envelope: NcpAgentSendEnvelope = {
      sessionId: "session-preallocated",
      message: {
        id: "user-preallocated",
        sessionId: "session-preallocated",
        role: "user",
        status: "final",
        parts: [{ type: "text", text: "show immediately" }],
        timestamp: now,
      },
    };
    let releaseSend = () => {};
    client.send.mockImplementationOnce(
      (pendingEnvelope) =>
        new Promise((resolve) => {
          releaseSend = () => resolve({
            sessionId: "session-preallocated",
            userMessageId: pendingEnvelope.message.id,
            assistantMessageId: "assistant-1",
            runId: "run-1",
          });
        }),
    );
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId?: string }) =>
        useNcpAgentRuntime({ sessionId, client, manager: manager as never }),
      { initialProps: { sessionId: undefined as string | undefined } },
    );

    let sendPromise!: ReturnType<typeof result.current.send>;
    act(() => {
      sendPromise = result.current.send(envelope);
    });

    await waitFor(() => {
      expect(result.current.visibleMessages).toEqual([envelope.message]);
    });
    expect(result.current.isSending).toBe(true);

    await act(async () => {
      releaseSend();
      await sendPromise;
    });
    rerender({ sessionId: "session-preallocated" });

    expect(result.current.visibleMessages).toEqual([envelope.message]);
    expect(result.current.isRunning).toBe(true);

    await act(async () => {
      await client.emit({
        type: NcpEventType.MessageSent,
        payload: {
          sessionId: "session-preallocated",
          message: envelope.message as NcpMessage,
        },
      });
    });
    await waitFor(() => {
      expect(result.current.visibleMessages).toEqual([envelope.message]);
    });
  });

  it("shows an existing-session user message before send returns and deduplicates the server event", async () => {
    const client = new DeferredSendClient();
    const manager = new DefaultNcpAgentConversationStateManager();
    const envelope: NcpAgentSendEnvelope = {
      sessionId: "session-existing",
      message: {
        id: "user-optimistic",
        sessionId: "session-existing",
        role: "user",
        status: "final",
        parts: [{ type: "text", text: "hello now" }],
        timestamp: now,
      },
    };
    let releaseSend = () => {};
    client.send.mockImplementationOnce(
      (pendingEnvelope) =>
        new Promise((resolve) => {
          releaseSend = () =>
            resolve({
              sessionId: "session-existing",
              userMessageId: pendingEnvelope.message.id,
              assistantMessageId: "assistant-1",
              runId: "run-1",
            });
        }),
    );
    const { result } = renderHook(() =>
      useNcpAgentRuntime({
        sessionId: "session-existing",
        client,
        manager: manager as never,
      }),
    );

    let sendPromise!: ReturnType<typeof result.current.send>;
    act(() => {
      sendPromise = result.current.send(envelope);
    });

    await waitFor(() => {
      expect(result.current.visibleMessages).toEqual([envelope.message]);
    });

    await act(async () => {
      await client.emit({
        type: NcpEventType.MessageSent,
        payload: {
          sessionId: "session-existing",
          message: envelope.message as NcpMessage,
        },
      });
    });
    await waitFor(() => {
      expect(result.current.visibleMessages).toHaveLength(1);
    });

    await act(async () => {
      releaseSend();
      await sendPromise;
    });
    expect(result.current.visibleMessages).toEqual([envelope.message]);
  });

  it("keeps an earlier streaming assistant before a later optimistic user message", async () => {
    const client = new DeferredSendClient();
    const manager = new DefaultNcpAgentConversationStateManager();
    manager.hydrate({
      sessionId: "session-existing",
      messages: [
        {
          id: "user-first",
          sessionId: "session-existing",
          role: "user",
          status: "final",
          parts: [{ type: "text", text: "start" }],
          timestamp: "2026-05-14T00:00:00.000Z",
        },
        {
          id: "assistant-old",
          sessionId: "session-existing",
          role: "assistant",
          status: "streaming",
          parts: [{ type: "text", text: "working" }],
          timestamp: "2026-05-14T00:00:01.000Z",
        },
      ],
    });
    await manager.dispatch({
      type: NcpEventType.MessageTextStart,
      payload: { sessionId: "session-existing", messageId: "assistant-old" },
    });
    const { result } = renderHook(() =>
      useNcpAgentRuntime({ sessionId: "session-existing", client, manager: manager as never }),
    );

    await act(async () => {
      await result.current.send({
        sessionId: "session-existing",
        message: {
          id: "user-later",
          sessionId: "session-existing",
          role: "user",
          status: "final",
          parts: [{ type: "text", text: "later" }],
          timestamp: "2026-05-14T00:00:02.000Z",
        },
      });
    });

    expect(result.current.visibleMessages.map((message) => message.id)).toEqual([
      "user-first",
      "assistant-old",
      "user-later",
    ]);
  });

});

describe("useNcpAgentRuntime commands and live stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks an optimistic user message as failed when send fails", async () => {
    const client = new DeferredSendClient();
    const manager = new DefaultNcpAgentConversationStateManager();
    const envelope: NcpAgentSendEnvelope = {
      sessionId: "session-existing",
      message: {
        id: "user-failed",
        sessionId: "session-existing",
        role: "user",
        status: "final",
        parts: [{ type: "text", text: "please retry" }],
        timestamp: now,
      },
    };
    client.send.mockRejectedValueOnce(new Error("network unavailable"));
    const { result } = renderHook(() =>
      useNcpAgentRuntime({
        sessionId: "session-existing",
        client,
        manager: manager as never,
      }),
    );

    await act(async () => {
      await expect(result.current.send(envelope)).rejects.toThrow(
        "network unavailable",
      );
    });

    expect(result.current.visibleMessages).toEqual([
      expect.objectContaining({
        ...envelope.message,
        status: "error",
      }),
    ]);
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

    expect(client.abort).toHaveBeenCalledWith({
      sessionId: "session-running",
      runId: undefined,
      reason: {
        code: "abort-error",
        message: "User stopped the current run.",
        details: { source: "chat-ui" },
      },
    });
  });

  it("adopts an accepted run before persisted run.started arrives", async () => {
    const client = new DeferredSendClient();
    const manager = new DefaultNcpAgentConversationStateManager();
    const { result } = renderHook(() =>
      useNcpAgentRuntime({ sessionId: "session-running", client, manager: manager as never }),
    );

    await act(async () => {
      await result.current.acceptRun({
        assistantMessageId: null,
        sessionId: "session-running",
        userMessageId: "continuation-user-1",
        runId: "run-accepted-1",
      });
    });

    expect(result.current.activeRunId).toBe("run-accepted-1");
    expect(result.current.isRunning).toBe(true);
    await act(async () => {
      await result.current.abort();
    });
    expect(client.abort).toHaveBeenCalledWith(expect.objectContaining({
      runId: "run-accepted-1",
    }));
  });

  it("clears the local running state when the live stream publishes message.abort", async () => {
    const client = new DeferredSendClient();
    const manager = new DefaultNcpAgentConversationStateManager();
    const { result } = renderHook(() =>
      useNcpAgentRuntime({ sessionId: "session-running", client, manager: manager as never }),
    );

    await act(async () => {
      await client.emit({
        type: NcpEventType.RunStarted,
        payload: {
          sessionId: "session-running",
          messageId: "assistant-1",
          runId: "run-1",
        },
      });
    });

    await waitFor(() => {
      expect(result.current.isRunning).toBe(true);
      expect(result.current.activeRunId).toBe("run-1");
    });

    await act(async () => {
      await result.current.abort();
    });

    expect(client.abort).toHaveBeenCalledWith({
      sessionId: "session-running",
      runId: "run-1",
      reason: {
        code: "abort-error",
        message: "User stopped the current run.",
        details: { source: "chat-ui" },
      },
    });

    await act(async () => {
      await client.emit({
        type: NcpEventType.MessageAbort,
        payload: {
          sessionId: "session-running",
          messageId: "assistant-1",
        },
      });
    });

    await waitFor(() => {
      expect(result.current.isRunning).toBe(false);
      expect(result.current.activeRunId).toBeNull();
    });
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

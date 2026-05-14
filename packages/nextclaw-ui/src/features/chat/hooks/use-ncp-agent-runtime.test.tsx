import { act, renderHook, waitFor } from "@testing-library/react";
import {
  type NcpAgentClientEndpoint,
  type NcpAgentSendEnvelope,
  type NcpEndpointEvent,
  type NcpEndpointManifest,
  type NcpEndpointSubscriber,
  NcpEventType,
} from "@nextclaw/ncp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DefaultNcpAgentConversationStateManager } from "../../../../../ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-conversation-state-manager.ts";
import { useNcpAgentRuntime } from "../../../../../ncp-packages/nextclaw-ncp-react/src/hooks/use-ncp-agent-runtime.ts";

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
  private releaseCompletion: (() => void) | null = null;
  private completionGate = new Promise<void>((resolve) => {
    this.releaseCompletion = resolve;
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

  send = vi.fn(async (_envelope: NcpAgentSendEnvelope): Promise<void> => {
    this.publish({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-created",
        message: {
          id: "user-1",
          sessionId: "session-created",
          role: "user",
          status: "final",
          parts: [{ type: "text", text: "hello" }],
          timestamp: now,
        },
      },
    });
    this.publish({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: "session-created",
        messageId: "assistant-1",
        runId: "run-1",
      },
    });
    await this.completionGate;
    this.publish({
      type: NcpEventType.MessageTextStart,
      payload: {
        sessionId: "session-created",
        messageId: "assistant-1",
      },
    });
    this.publish({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: "session-created",
        messageId: "assistant-1",
        delta: "done",
      },
    });
    this.publish({
      type: NcpEventType.MessageTextEnd,
      payload: {
        sessionId: "session-created",
        messageId: "assistant-1",
      },
    });
    this.publish({
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId: "session-created",
        message: {
          id: "assistant-1",
          sessionId: "session-created",
          role: "assistant",
          status: "final",
          parts: [{ type: "text", text: "done" }],
          timestamp: now,
        },
      },
    });
    this.publish({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-created",
        runId: "run-1",
      },
    });
  });

  release = (): void => {
    this.releaseCompletion?.();
  };

  private publish = (event: NcpEndpointEvent): void => {
    for (const listener of this.listeners) {
      listener(event);
    }
  };
}

describe("useNcpAgentRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the active send stream alive when a new root chat materializes a session id", async () => {
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

    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.send(envelope);
    });

    await waitFor(() => {
      expect(result.current.snapshot.activeRun?.sessionId).toBe("session-created");
    });

    rerender({ sessionId: "session-created" });

    expect(client.stop).not.toHaveBeenCalled();

    await act(async () => {
      client.release();
      await sendPromise;
    });

    await waitFor(() => {
      expect(result.current.snapshot.activeRun).toBeNull();
    });
    expect(result.current.visibleMessages.map((message) => message.id)).toEqual([
      "user-1",
      "assistant-1",
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

    expect(client.abort).toHaveBeenCalledWith({ sessionId: "session-running" });
  });
});

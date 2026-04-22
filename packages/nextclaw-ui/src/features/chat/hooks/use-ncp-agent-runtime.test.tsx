import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import { useNcpAgentRuntime } from "../../../../../ncp-packages/nextclaw-ncp-react/src/hooks/use-ncp-agent-runtime.ts";

function createEvent(type: NcpEventType, delta: string): NcpEndpointEvent {
  return {
    type,
    payload: {
      sessionId: "session-1",
      messageId: "assistant-1",
      toolCallId: "tool-1",
      delta,
    },
  } as NcpEndpointEvent;
}

describe("useNcpAgentRuntime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("batches streamed endpoint events before dispatching them to the manager", async () => {
    let subscriber: ((event: NcpEndpointEvent) => void) | null = null;
    const snapshot = {
      messages: [],
      streamingMessage: null,
      error: null,
      activeRun: null,
    };
    const client = {
      subscribe: vi.fn((callback: (event: NcpEndpointEvent) => void) => {
        subscriber = callback;
        return () => {
          subscriber = null;
        };
      }),
      stop: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
      stream: vi.fn().mockResolvedValue(undefined),
    };
    const manager = {
      getSnapshot: vi.fn(() => snapshot),
      subscribe: vi.fn(() => () => {}),
      dispatch: vi.fn().mockResolvedValue(undefined),
      dispatchBatch: vi.fn().mockResolvedValue(undefined),
    };

    renderHook(() =>
      useNcpAgentRuntime({
        sessionId: "session-1",
        client: client as never,
        manager: manager as never,
      }),
    );

    expect(subscriber).not.toBeNull();

    act(() => {
      subscriber?.(createEvent(NcpEventType.MessageToolCallArgsDelta, '{"path":"src/app.ts",'));
      subscriber?.(
        createEvent(
          NcpEventType.MessageToolCallArgsDelta,
          '"content":"console.log(1);"}',
        ),
      );
    });

    expect(manager.dispatchBatch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(16);
      await Promise.resolve();
    });

    expect(manager.dispatchBatch).toHaveBeenCalledTimes(1);
    expect(manager.dispatchBatch).toHaveBeenCalledWith([
      createEvent(NcpEventType.MessageToolCallArgsDelta, '{"path":"src/app.ts",'),
      createEvent(
        NcpEventType.MessageToolCallArgsDelta,
        '"content":"console.log(1);"}',
      ),
    ]);
  });
});

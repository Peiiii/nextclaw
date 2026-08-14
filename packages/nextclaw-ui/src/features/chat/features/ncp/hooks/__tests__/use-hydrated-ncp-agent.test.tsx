import { act, renderHook, waitFor } from "@testing-library/react";
import {
  NcpEventType,
  type NcpAgentClientEndpoint,
  type NcpEndpointSubscriber,
  type NcpMessage,
} from "@nextclaw/ncp";
import { useHydratedNcpAgent, useNcpAgentRuntime } from "@nextclaw/ncp-react";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  stream: vi.fn(),
  stop: vi.fn(),
}));

describe("useHydratedNcpAgent", () => {
  beforeEach(() => {
    mocks.send.mockReset();
    mocks.stream.mockReset();
    mocks.stop.mockReset();
  });

  it("clears a draft conversation error when a valid retry starts", async () => {
    const client = {
      send: mocks.send.mockResolvedValue(null),
      stop: mocks.stop.mockResolvedValue(undefined),
      stream: mocks.stream.mockResolvedValue(undefined),
      subscribe: vi.fn(() => () => {}),
    } as unknown as NcpAgentClientEndpoint;
    const manager = new DefaultNcpAgentConversationStateManager();
    const { result } = renderHook(() =>
      useNcpAgentRuntime({
        client,
        manager,
      }),
    );

    await act(async () => {
      await manager.dispatch({
        occurredAt: new Date().toISOString(),
        type: NcpEventType.EndpointError,
        payload: {
          code: "runtime-error",
          message: "network error",
        },
      });
    });
    expect(result.current.snapshot.error?.message).toBe("network error");

    await act(async () => {
      await result.current.send("retry");
    });

    expect(result.current.snapshot.error).toBeNull();
    expect(mocks.send).toHaveBeenCalledOnce();
  });

  it("treats a newly selected session as hydrating immediately on rerender", async () => {
    const client = {
      stop: mocks.stop.mockResolvedValue(undefined),
      stream: mocks.stream.mockResolvedValue(undefined),
      subscribe: vi.fn(() => () => {}),
    } as unknown as NcpAgentClientEndpoint;
    const loadSeed = vi
      .fn()
      .mockResolvedValueOnce({ messages: [], status: "idle" })
      .mockResolvedValueOnce({ messages: [], status: "idle" });

    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) =>
        useHydratedNcpAgent({
          sessionId,
          client: client as never,
          loadSeed,
        }),
      {
        initialProps: {
          sessionId: "session-a",
        },
      },
    );

    await waitFor(() => {
      expect(result.current.isHydrating).toBe(false);
    });
    expect(mocks.stream).toHaveBeenCalledWith(
      { sessionId: "session-a" },
      expect.objectContaining({ onOpen: expect.any(Function) }),
    );

    rerender({ sessionId: "session-b" });

    expect(result.current.isHydrating).toBe(true);

    await waitFor(() => {
      expect(result.current.isHydrating).toBe(false);
    });
    expect(mocks.stream).toHaveBeenCalledWith(
      { sessionId: "session-b" },
      expect.objectContaining({ onOpen: expect.any(Function) }),
    );
    expect(mocks.stream).toHaveBeenCalledTimes(2);
  });

  it("keeps a selected session hydrated when an earlier empty-session reset finishes late", async () => {
    const stopResolvers: Array<() => void> = [];
    const client = {
      stop: mocks.stop.mockImplementation(
        () => new Promise<void>((resolve) => stopResolvers.push(resolve)),
      ),
      stream: mocks.stream.mockResolvedValue(undefined),
      subscribe: vi.fn(() => () => {}),
    } as unknown as NcpAgentClientEndpoint;
    const historyMessage = {
      id: "message-1",
      sessionId: "session-mobile",
      role: "user",
      status: "final",
      parts: [{ type: "text", text: "Existing history" }],
      timestamp: "2026-07-16T00:00:00.000Z",
    } as const;
    const loadSeed = vi.fn().mockResolvedValue({
      messages: [historyMessage],
      status: "idle",
    });

    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string | undefined }) =>
        useHydratedNcpAgent({
          sessionId,
          client: client as never,
          loadSeed,
        }),
      {
        initialProps: {
          sessionId: undefined as string | undefined,
        },
      },
    );

    await waitFor(() => expect(stopResolvers).toHaveLength(1));
    rerender({ sessionId: "session-mobile" });
    await waitFor(() => expect(stopResolvers).toHaveLength(2));

    await act(async () => {
      stopResolvers[1]?.();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.visibleMessages).toEqual([historyMessage]);
    });

    await act(async () => {
      stopResolvers[0]?.();
      await Promise.resolve();
    });
    expect(result.current.visibleMessages).toEqual([historyMessage]);
  });

  it("starts the live stream when a draft manager already contains the materialized session", async () => {
    let subscriber: NcpEndpointSubscriber | null = null;
    const client = {
      stop: mocks.stop.mockResolvedValue(undefined),
      stream: mocks.stream.mockImplementation(() => new Promise(() => {})),
      subscribe: vi.fn((nextSubscriber: NcpEndpointSubscriber) => {
        subscriber = nextSubscriber;
        return () => {};
      }),
    } as unknown as NcpAgentClientEndpoint;
    const loadSeed = vi.fn().mockResolvedValue({
      messages: [],
      status: "idle",
    });
    const materializedMessage: NcpMessage = {
      id: "message-materialized",
      sessionId: "session-materialized",
      role: "user",
      status: "final",
      parts: [{ type: "text", text: "Visible immediately" }],
      timestamp: "2026-07-24T00:00:00.000Z",
    };
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId?: string }) =>
        useHydratedNcpAgent({
          sessionId,
          client: client as never,
          loadSeed,
        }),
      { initialProps: { sessionId: undefined as string | undefined } },
    );

    await waitFor(() => {
      expect(subscriber).not.toBeNull();
    });
    act(() => {
      subscriber?.({
        type: NcpEventType.MessageSent,
        payload: {
          sessionId: "session-materialized",
          message: materializedMessage,
        },
      });
    });
    await waitFor(() => {
      expect(result.current.visibleMessages).toEqual([materializedMessage]);
    });

    rerender({ sessionId: "session-materialized" });

    await waitFor(() => {
      expect(result.current.isHydrating).toBe(false);
    });
    expect(loadSeed).not.toHaveBeenCalled();
    expect(mocks.stream).toHaveBeenCalledWith(
      { sessionId: "session-materialized" },
      expect.objectContaining({ onOpen: expect.any(Function) }),
    );
  });

  it("reloads missed state and remains usable after repeated live stream disconnects", async () => {
    vi.useFakeTimers();
    try {
      const connected = new Promise<void>(() => {});
      const client = {
        stop: mocks.stop.mockResolvedValue(undefined),
        stream: mocks.stream
          .mockRejectedValueOnce(new Error("stream disconnected"))
          .mockRejectedValueOnce(new Error("stream disconnected again"))
          .mockImplementationOnce(() => connected),
        subscribe: vi.fn(() => () => {}),
        send: mocks.send.mockResolvedValue({
          sessionId: "session-recovery",
          userMessageId: "user-after-recovery",
          assistantMessageId: null,
          runId: null,
        }),
      } as unknown as NcpAgentClientEndpoint;
      const recoveredMessage = {
        id: "message-recovered",
        sessionId: "session-recovery",
        role: "assistant",
        status: "final",
        parts: [{ type: "text", text: "Recovered" }],
        timestamp: "2026-07-24T00:01:00.000Z",
      } as const;
      const loadSeed = vi
        .fn()
        .mockResolvedValueOnce({ messages: [], status: "running" })
        .mockResolvedValueOnce({ messages: [], status: "running" })
        .mockResolvedValueOnce({
          messages: [recoveredMessage],
          status: "idle",
        });
      const { result } = renderHook(() =>
        useHydratedNcpAgent({
          sessionId: "session-recovery",
          client: client as never,
          loadSeed,
        }),
      );

      await vi.waitFor(() => {
        expect(mocks.stream).toHaveBeenCalledTimes(1);
      });
      expect(result.current.hydrateError).toBeNull();
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      await vi.waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(2));
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      await vi.waitFor(() => {
        expect(result.current.visibleMessages).toEqual([recoveredMessage]);
      });

      expect(loadSeed).toHaveBeenCalledTimes(3);
      expect(mocks.stream).toHaveBeenCalledTimes(3);
      expect(result.current.hydrateError).toBeNull();
      expect(result.current.isRunning).toBe(false);
      await act(async () => {
        await result.current.send("after recovery");
      });
      expect(mocks.send).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a stream error only after repeated immediate recovery failures", async () => {
    vi.useFakeTimers();
    try {
      const client = {
        stop: mocks.stop.mockResolvedValue(undefined),
        stream: mocks.stream.mockRejectedValue(new Error("stream unavailable")),
        subscribe: vi.fn(() => () => {}),
        send: mocks.send,
      } as unknown as NcpAgentClientEndpoint;
      const loadSeed = vi.fn().mockResolvedValue({ messages: [], status: "idle" });
      const { result } = renderHook(() =>
        useHydratedNcpAgent({
          sessionId: "session-offline",
          client: client as never,
          loadSeed,
        }),
      );

      await vi.waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(1));
      expect(result.current.hydrateError).toBeNull();

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      await vi.waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(2));
      expect(result.current.hydrateError).toBeNull();

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      await vi.waitFor(() => {
        expect(result.current.hydrateError?.message).toBe("stream unavailable");
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useHydratedNcpAgent stream reconciliation", () => {
  it("reconciles history after the stream opens without overwriting newer live completion", async () => {
    let subscriber: NcpEndpointSubscriber | null = null;
    let resolveReconcile: ((seed: { messages: readonly NcpMessage[]; status: "running" }) => void) | null = null;
    const reconcileSeed = new Promise<{ messages: readonly NcpMessage[]; status: "running" }>((resolve) => {
      resolveReconcile = resolve;
    });
    const client = {
      stop: mocks.stop.mockResolvedValue(undefined),
      stream: mocks.stream.mockImplementation((_payload, observer) => {
        observer?.onOpen?.();
        return new Promise<void>(() => {});
      }),
      subscribe: vi.fn((nextSubscriber: NcpEndpointSubscriber) => {
        subscriber = nextSubscriber;
        return () => {};
      }),
    } as unknown as NcpAgentClientEndpoint;
    const loadSeed = vi
      .fn()
      .mockResolvedValueOnce({ messages: [], status: "running" })
      .mockImplementationOnce(() => reconcileSeed);
    const finalMessage: NcpMessage = {
      id: "assistant-gap",
      sessionId: "session-gap",
      role: "assistant",
      status: "final",
      parts: [{ type: "text", text: "Recovered without refresh" }],
      timestamp: "2026-08-14T00:00:00.000Z",
    };
    const { result } = renderHook(() =>
      useHydratedNcpAgent({
        sessionId: "session-gap",
        client,
        loadSeed,
      }),
    );

    await waitFor(() => expect(loadSeed).toHaveBeenCalledTimes(2));
    act(() => {
      subscriber?.({
        type: NcpEventType.MessageSent,
        payload: { sessionId: "session-gap", message: finalMessage },
      });
      subscriber?.({
        type: NcpEventType.RunFinished,
        payload: { sessionId: "session-gap", runId: "run-gap" },
      });
    });
    await waitFor(() => expect(result.current.visibleMessages).toEqual([finalMessage]));

    await act(async () => {
      resolveReconcile?.({
        messages: [{ ...finalMessage, status: "streaming", parts: [{ type: "text", text: "Recovered" }] }],
        status: "running",
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.visibleMessages).toEqual([finalMessage]);
      expect(result.current.isRunning).toBe(false);
    });
  });
});

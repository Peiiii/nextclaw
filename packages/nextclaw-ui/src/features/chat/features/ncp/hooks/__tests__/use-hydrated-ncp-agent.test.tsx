import { act, renderHook, waitFor } from "@testing-library/react";
import { NcpEventType, type NcpAgentClientEndpoint } from "@nextclaw/ncp";
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
    expect(mocks.stream).toHaveBeenCalledWith({ sessionId: "session-a" });

    rerender({ sessionId: "session-b" });

    expect(result.current.isHydrating).toBe(true);

    await waitFor(() => {
      expect(result.current.isHydrating).toBe(false);
    });
    expect(mocks.stream).toHaveBeenCalledWith({ sessionId: "session-b" });
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
});

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
});

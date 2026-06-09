import { renderHook, waitFor } from "@testing-library/react";
import type { NcpAgentClientEndpoint } from "@nextclaw/ncp";
import { useHydratedNcpAgent } from "@nextclaw/ncp-react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  stop: vi.fn(),
}));

describe("useHydratedNcpAgent", () => {
  beforeEach(() => {
    mocks.stream.mockReset();
    mocks.stop.mockReset();
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

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as SharedApi from "@/shared/lib/api";
import {
  fetchNcpSessionConversationSeed,
  useNcpSessionConversation,
} from "@/features/chat/features/ncp/hooks/use-ncp-session-conversation";

const mocks = vi.hoisted(() => ({
  fetchNcpSessionMessages: vi.fn(),
  prependHistory: vi.fn(),
  hydratedCalls: [] as Array<{ client: unknown; loadSeed: unknown }>,
  runtimeAvailability: {
    phase: "cold-starting" as "cold-starting" | "ready",
    lastReadyAt: null as number | null,
  },
  useHydratedNcpAgent: vi.fn(() => ({
    snapshot: {
      messages: [],
      streamingMessage: null,
      activeRun: null,
      error: null as Error | null,
    },
    visibleMessages: [],
    activeRunId: null,
    isRunning: false,
    isSending: false,
    send: vi.fn(),
    abort: vi.fn(),
    streamRun: vi.fn(),
    prependHistory: mocks.prependHistory,
    isHydrating: false,
    hydrateError: null,
  })),
  clientInstances: [] as unknown[],
}));

vi.mock("@/shared/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    fetchNcpSessionMessages: mocks.fetchNcpSessionMessages,
  };
});

vi.mock("@nextclaw/ncp-react", () => ({
  useHydratedNcpAgent: vi.fn(
    (params: { client: unknown; loadSeed: unknown }) => {
    mocks.hydratedCalls.push(params);
    return mocks.useHydratedNcpAgent();
    },
  ),
}));

vi.mock("@nextclaw/ncp-http-agent-client", () => ({
  NcpHttpAgentClientEndpoint: vi.fn().mockImplementation(function MockClient(
    this: object,
  ) {
    mocks.clientInstances.push(this);
  }),
}));

vi.mock("@/features/system-status", () => ({
  useSystemStatus: vi.fn(() => ({
    ...mocks.runtimeAvailability,
    lifecyclePhase: mocks.runtimeAvailability.phase,
    activeSystemAction: null,
    bootstrapStatus: null,
    lastError: null,
  })),
}));

describe("useNcpSessionConversation", () => {
  beforeEach(() => {
    mocks.fetchNcpSessionMessages.mockReset();
    mocks.prependHistory.mockReset();
    mocks.useHydratedNcpAgent.mockClear();
    mocks.hydratedCalls.length = 0;
    mocks.clientInstances.length = 0;
    mocks.runtimeAvailability.phase = "cold-starting";
    mocks.runtimeAvailability.lastReadyAt = null;
  });

  it("hydrates seed from the shared session messages endpoint payload", async () => {
    mocks.fetchNcpSessionMessages.mockResolvedValue({
      sessionId: "session-1",
      status: "running",
      total: 1,
      pageInfo: { startCursor: "cursor-1", hasPreviousPage: false },
      messages: [{ id: "msg-1" }],
      contextWindow: {
        usedContextTokens: 42,
        totalContextTokens: 100,
        prunedUsedContextTokens: 42,
        availableContextTokens: 58,
        droppedHistoryCount: 0,
        truncatedToolResultCount: 0,
        truncatedSystemPrompt: false,
        truncatedUserMessage: false,
        compacted: false,
        compactedMessageCount: 0,
        updatedAt: "2026-05-05T00:00:00.000Z",
      },
    });

    const result = await fetchNcpSessionConversationSeed(
      "session-1",
      new AbortController().signal,
      300,
    );

    expect(mocks.fetchNcpSessionMessages).toHaveBeenCalledWith("session-1", {
      limit: 300,
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual({
      messages: [{ id: "msg-1" }],
      status: "running",
      contextWindow: {
        usedContextTokens: 42,
        totalContextTokens: 100,
        prunedUsedContextTokens: 42,
        availableContextTokens: 58,
        droppedHistoryCount: 0,
        truncatedToolResultCount: 0,
        truncatedSystemPrompt: false,
        truncatedUserMessage: false,
        compacted: false,
        compactedMessageCount: 0,
        updatedAt: "2026-05-05T00:00:00.000Z",
      },
      total: 1,
      pageInfo: { startCursor: "cursor-1", hasPreviousPage: false },
    });
  });

  it("treats a missing session as an empty idle draft seed", async () => {
    mocks.fetchNcpSessionMessages.mockRejectedValue(
      new Error("ncp session not found: draft-session"),
    );

    const result = await fetchNcpSessionConversationSeed(
      "draft-session",
      new AbortController().signal,
    );

    expect(result).toEqual({
      messages: [],
      status: "idle",
      total: 0,
      pageInfo: { startCursor: null, hasPreviousPage: false },
    });
  });

  it("creates an isolated endpoint instance per viewer", () => {
    renderHook(() => useNcpSessionConversation("session-a"));
    renderHook(() => useNcpSessionConversation("session-b"));

    expect(mocks.useHydratedNcpAgent).toHaveBeenCalledTimes(2);
    expect(mocks.clientInstances).toHaveLength(2);
    expect(mocks.hydratedCalls).toHaveLength(2);
    expect(mocks.clientInstances[0]).not.toBe(mocks.clientInstances[1]);
    expect(mocks.hydratedCalls[0]?.client).toBe(mocks.clientInstances[0]);
    expect(mocks.hydratedCalls[1]?.client).toBe(mocks.clientInstances[1]);
  });

  it("passes an empty session through without requesting a draft history seed", () => {
    renderHook(() => useNcpSessionConversation(undefined));

    expect(mocks.useHydratedNcpAgent).toHaveBeenCalledTimes(1);
    expect(mocks.hydratedCalls[0]).toMatchObject({
      sessionId: undefined,
    });
    expect(mocks.fetchNcpSessionMessages).not.toHaveBeenCalled();
  });

  it("exposes the hydrated session context window without changing the generic ncp agent seed", async () => {
    const contextWindow = {
      usedContextTokens: 42,
      totalContextTokens: 100,
      prunedUsedContextTokens: 42,
      availableContextTokens: 58,
      droppedHistoryCount: 0,
      truncatedToolResultCount: 0,
      truncatedSystemPrompt: false,
      truncatedUserMessage: false,
      compacted: false,
      compactedMessageCount: 0,
      updatedAt: "2026-05-05T00:00:00.000Z",
    };
    mocks.fetchNcpSessionMessages.mockResolvedValue({
      sessionId: "session-1",
      status: "idle",
      total: 0,
      pageInfo: { startCursor: null, hasPreviousPage: false },
      messages: [],
      contextWindow,
    });

    const { result, rerender } = renderHook(() =>
      useNcpSessionConversation("session-1"),
    );
    const loadSeed = mocks.hydratedCalls[0]?.loadSeed as (
      sessionId: string,
      signal: AbortSignal,
    ) => Promise<{ messages: unknown[]; status: string }>;

    await act(async () => {
      await expect(
        loadSeed("session-1", new AbortController().signal),
      ).resolves.toEqual({
        messages: [],
        status: "idle",
      });
    });
    rerender();

    expect(result.current.snapshot.contextWindow).toEqual(contextWindow);
  });

  it("loads previous pages to the terminal state without repeating the last cursor", async () => {
    mocks.fetchNcpSessionMessages
      .mockResolvedValueOnce({
        sessionId: "session-1",
        status: "idle",
        total: 5,
        pageInfo: { startCursor: "cursor-4", hasPreviousPage: true },
        messages: [{ id: "message-4" }, { id: "message-5" }],
      })
      .mockResolvedValueOnce({
        sessionId: "session-1",
        status: "idle",
        total: 5,
        pageInfo: { startCursor: "cursor-2", hasPreviousPage: true },
        messages: [{ id: "message-2" }, { id: "message-3" }],
      })
      .mockResolvedValueOnce({
        sessionId: "session-1",
        status: "idle",
        total: 5,
        pageInfo: { startCursor: "cursor-1", hasPreviousPage: false },
        messages: [{ id: "message-1" }],
      });
    const { result } = renderHook(() => useNcpSessionConversation("session-1"));
    const loadSeed = mocks.hydratedCalls[0]?.loadSeed as (
      sessionId: string,
      signal: AbortSignal,
    ) => Promise<{ messages: unknown[]; status: string }>;
    await act(async () => {
      await loadSeed("session-1", new AbortController().signal);
    });

    await act(async () => {
      await result.current.loadPreviousMessages();
      await result.current.loadPreviousMessages();
      await result.current.loadPreviousMessages();
    });

    expect(mocks.fetchNcpSessionMessages).toHaveBeenLastCalledWith(
      "session-1",
      {
        limit: 80,
        cursor: "cursor-2",
        signal: expect.any(AbortSignal),
      },
    );
    expect(mocks.fetchNcpSessionMessages).toHaveBeenCalledTimes(3);
    expect(mocks.prependHistory).toHaveBeenNthCalledWith(1, [
      { id: "message-2" },
      { id: "message-3" },
    ]);
    expect(mocks.prependHistory).toHaveBeenNthCalledWith(2, [
      { id: "message-1" },
    ]);
    expect(result.current.hasPreviousMessages).toBe(false);
    expect(result.current.messageTotal).toBe(5);
  });

  it("drops an in-flight history page when the viewer switches sessions", async () => {
    let resolvePreviousPage = (_value: unknown): void => {
      throw new Error("Previous page request was not initialized.");
    };
    mocks.fetchNcpSessionMessages
      .mockResolvedValueOnce({
        sessionId: "session-a",
        status: "idle",
        total: 2,
        pageInfo: { startCursor: "cursor-2", hasPreviousPage: true },
        messages: [{ id: "message-2" }],
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePreviousPage = resolve;
          }),
      );
    const { result, rerender } = renderHook(
      ({ sessionId }) => useNcpSessionConversation(sessionId),
      { initialProps: { sessionId: "session-a" } },
    );
    const loadSeed = mocks.hydratedCalls[0]?.loadSeed as (
      sessionId: string,
      signal: AbortSignal,
    ) => Promise<{ messages: unknown[]; status: string }>;
    await act(async () => {
      await loadSeed("session-a", new AbortController().signal);
    });

    let previousPagePromise: Promise<void> | null = null;
    act(() => {
      previousPagePromise = result.current.loadPreviousMessages();
    });
    rerender({ sessionId: "session-b" });
    resolvePreviousPage({
      sessionId: "session-a",
      status: "idle",
      total: 2,
      pageInfo: { startCursor: "cursor-1", hasPreviousPage: false },
      messages: [{ id: "message-1" }],
    });
    await act(async () => {
      await previousPagePromise;
    });

    expect(mocks.prependHistory).not.toHaveBeenCalled();
    expect(result.current.isLoadingPreviousMessages).toBe(false);
  });

  it("retries hydration once the runtime becomes ready after a startup placeholder error", async () => {
    mocks.useHydratedNcpAgent.mockImplementation(() => ({
      snapshot: {
        messages: [],
        streamingMessage: null,
        activeRun: null,
        error: new Error(
          "ncp agent unavailable during startup",
        ) as Error | null,
      },
      visibleMessages: [],
      activeRunId: null,
      isRunning: false,
      isSending: false,
      send: vi.fn(),
      abort: vi.fn(),
      streamRun: vi.fn(),
      prependHistory: mocks.prependHistory,
      isHydrating: false,
      hydrateError: null,
    }));

    const { rerender } = renderHook(() =>
      useNcpSessionConversation("session-a"),
    );
    const initialLoadSeed = mocks.hydratedCalls[0]?.loadSeed;

    act(() => {
      mocks.runtimeAvailability.phase = "ready";
      mocks.runtimeAvailability.lastReadyAt = 123;
    });
    rerender();

    await waitFor(() => {
      expect(mocks.hydratedCalls.length).toBeGreaterThan(2);
    });
    expect(
      mocks.hydratedCalls[mocks.hydratedCalls.length - 1]?.loadSeed,
    ).not.toBe(initialLoadSeed);
  });
});

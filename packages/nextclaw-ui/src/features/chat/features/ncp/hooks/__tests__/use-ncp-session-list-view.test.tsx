import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNcpSessionListView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import type { NcpSessionSummaryView } from "@/shared/lib/api";

const mocks = vi.hoisted(() => ({
  sessions: [] as NcpSessionSummaryView[],
}));

vi.mock("@/features/chat/features/ncp/hooks/use-ncp-session-queries", () => ({
  useNcpSessions: () => ({
    data: {
      sessions: mocks.sessions,
      total: mocks.sessions.length,
    },
    isLoading: false,
  }),
}));

function createSummary(
  sessionId: string,
  label: string,
): NcpSessionSummaryView {
  return {
    sessionId,
    status: "idle",
    updatedAt: "2026-06-18T00:00:00.000Z",
    lastMessageAt: "2026-06-18T00:00:00.000Z",
    messageCount: 1,
    metadata: {
      label,
      session_type: "native",
    },
  };
}

describe("useNcpSessionListView", () => {
  beforeEach(() => {
    mocks.sessions = [
      createSummary("session:alpha", "Alpha Task"),
      createSummary("session:beta", "Beta Task"),
    ];
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        query: "",
      },
    });
  });

  it("uses the sidebar query by default", () => {
    useChatSessionListStore.getState().setSnapshot({ query: "Alpha" });

    const { result } = renderHook(() => useNcpSessionListView());

    expect(result.current.items.map((item) => item.session.key)).toEqual([
      "session:alpha",
    ]);
  });

  it("can override the hidden sidebar query for header switching", () => {
    useChatSessionListStore.getState().setSnapshot({ query: "Alpha" });

    const { result } = renderHook(() =>
      useNcpSessionListView({ query: "" }),
    );

    expect(result.current.items.map((item) => item.session.key)).toEqual([
      "session:alpha",
      "session:beta",
    ]);
  });
});

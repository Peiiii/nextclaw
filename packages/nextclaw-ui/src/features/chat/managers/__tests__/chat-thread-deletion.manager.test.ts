import { beforeEach, describe, expect, it, vi } from "vitest";
import { appQueryClient } from "@/app-query-client";
import { ChatThreadManager } from "@/features/chat/managers/chat-thread.manager";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import type * as SharedApi from "@/shared/lib/api";

const { deleteNcpSessionMock, deleteSummaryMock, toast } = vi.hoisted(() => ({
  deleteNcpSessionMock: vi.fn(),
  deleteSummaryMock: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/shared/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    deleteNcpSession: deleteNcpSessionMock,
    deleteNcpSessionSummaryInQueryClient: deleteSummaryMock,
  };
});

vi.mock("sonner", () => ({ toast }));

function createUiManager() {
  return {
    confirm: vi.fn(async () => true),
    goToChatRoot: vi.fn(),
  } as unknown as ConstructorParameters<typeof ChatThreadManager>[0];
}

beforeEach(() => {
  deleteNcpSessionMock.mockReset();
  deleteNcpSessionMock.mockResolvedValue({
    deleted: true,
    sessionId: "parent-session-1",
  });
  deleteSummaryMock.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  useChatSessionListStore.setState({
    snapshot: {
      ...useChatSessionListStore.getInitialState().snapshot,
      selectedSessionKey: "parent-session-1",
    },
  });
  useChatThreadStore.setState({
    snapshot: {
      ...useChatThreadStore.getInitialState().snapshot,
      sessionKey: "parent-session-1",
      canDeleteSession: true,
      childSessionTabs: [
        {
          sessionKey: "child-session-1",
          parentSessionKey: "parent-session-1",
          label: "Child Session 1",
          agentId: "reviewer",
        },
      ],
    },
  });
});

describe("ChatThreadManager deletion", () => {
  it("clears the current thread and confirms the deletion", async () => {
    const uiManager = createUiManager();
    const removeQueries = vi
      .spyOn(appQueryClient, "removeQueries")
      .mockImplementation(async () => undefined);
    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    await manager.deleteSession();

    expect(useChatThreadStore.getState().snapshot.sessionKey).toBeNull();
    expect(deleteSummaryMock).toHaveBeenCalledWith(
      appQueryClient,
      "parent-session-1",
    );
    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: ["ncp-session-messages", "parent-session-1"],
    });
    expect(uiManager.goToChatRoot).toHaveBeenCalledWith({ replace: true });
    expect(toast.success).toHaveBeenCalledWith("Session deleted.");
  });

  it("preserves the current thread when deleting another session", async () => {
    const uiManager = createUiManager();
    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    await manager.deleteSession("other-session-1");

    expect(deleteNcpSessionMock).toHaveBeenCalledWith("other-session-1");
    expect(useChatThreadStore.getState().snapshot.sessionKey).toBe(
      "parent-session-1",
    );
    expect(uiManager.goToChatRoot).not.toHaveBeenCalled();
  });

  it("keeps the session visible and reports a deletion error", async () => {
    deleteNcpSessionMock.mockRejectedValueOnce(
      new Error("network unavailable"),
    );
    const uiManager = createUiManager();
    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    await manager.deleteSession();

    expect(useChatThreadStore.getState().snapshot.sessionKey).toBe(
      "parent-session-1",
    );
    expect(uiManager.goToChatRoot).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Could not delete session: network unavailable",
    );
  });
});

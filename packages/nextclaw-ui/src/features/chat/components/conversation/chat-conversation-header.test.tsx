import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatConversationHeader } from "@/features/chat/components/conversation/chat-conversation-header";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";

vi.mock("@/shared/components/common/agent-avatar", () => ({
  AgentAvatar: ({ agentId }: { agentId: string }) => (
    <div data-testid="agent-avatar">{agentId}</div>
  ),
}));

function renderHeader(
  snapshotPatch: Partial<ReturnType<typeof useChatThreadStore.getState>["snapshot"]>,
) {
  const queryClient = new QueryClient();
  const snapshot = {
    ...useChatThreadStore.getState().snapshot,
    isProviderStateResolved: true,
    modelOptions: [],
    sessionTypeLabel: "Codex",
    sessionKey: null,
    agentId: "main",
    canDeleteSession: false,
    messages: [],
    ...snapshotPatch,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <ChatConversationHeader
        snapshot={snapshot}
        childSessionCount={0}
        sessionCronJobCount={0}
        layoutMode="desktop"
        normalizedAgentId={snapshot.agentId ?? ""}
        sessionHeaderTitle={snapshot.sessionDisplayName ?? "New Task"}
        shouldShowHeaderAgentAvatar={false}
        shouldShowSessionHeader={Boolean(
          snapshot.sessionKey || snapshot.sessionTypeLabel,
        )}
        onOpenChildSessions={vi.fn()}
        onOpenSessionCronJobs={vi.fn()}
        onDeleteSession={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("ChatConversationHeader", () => {
  it("uses a stable desktop height before and after session materialization", () => {
    renderHeader({});

    const header = screen.getByText("New Task").closest(".border-b");

    expect(header?.className).toContain("h-[52px]");
    expect(header?.className).not.toContain("transition-all");
  });

  it("uses the standard session-header action button density after the session is materialized", () => {
    renderHeader({
      sessionKey: "session-1",
      canDeleteSession: true,
      sessionDisplayName: "First message",
    });

    const moreActions = screen.getByRole("button", { name: "More actions" });
    const header = screen.getByText("First message").closest(".border-b");

    expect(header?.className).toContain("h-[52px]");
    expect(moreActions.className).toContain("h-7");
    expect(moreActions.className).toContain("w-7");
  });
});

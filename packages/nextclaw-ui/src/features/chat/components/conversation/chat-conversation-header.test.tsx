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
        layoutMode="desktop"
        normalizedAgentId={snapshot.agentId ?? ""}
        sessionHeaderTitle={snapshot.sessionDisplayName ?? "New Task"}
        shouldShowHeaderAgentAvatar={false}
        shouldShowSessionHeader={Boolean(
          snapshot.sessionKey || snapshot.sessionTypeLabel,
        )}
        onOpenChildSessions={vi.fn()}
        onDeleteSession={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("ChatConversationHeader", () => {
  it("does not reserve extra height for draft sessions", () => {
    renderHeader({});

    const header = screen.getByText("New Task").closest(".border-b");

    expect(header?.className).not.toContain("min-h-");
  });

  it("uses compact action buttons after the session is materialized", () => {
    renderHeader({
      sessionKey: "session-1",
      canDeleteSession: true,
      sessionDisplayName: "First message",
    });

    const moreActions = screen.getByRole("button", { name: "More actions" });

    expect(moreActions.className).toContain("h-5");
    expect(moreActions.className).toContain("w-5");
  });
});

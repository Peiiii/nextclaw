import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatConversationHeader } from "@/features/chat/components/conversation/chat-conversation-header";
import { ChatSessionHeaderActions } from "@/features/chat/features/session/components/session-header/chat-session-header-actions";

vi.mock("@/shared/components/common/agent-avatar", () => ({
  AgentAvatar: ({ agentId }: { agentId: string }) => (
    <div data-testid="agent-avatar">{agentId}</div>
  ),
}));

function renderHeader({
  actions,
  shouldShow = true,
  title = "New Task",
}: {
  actions?: JSX.Element | null;
  shouldShow?: boolean;
  title?: string;
} = {}) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ChatConversationHeader
        layoutMode="desktop"
        title={title}
        shouldShow={shouldShow}
        actions={actions}
      />
    </QueryClientProvider>,
  );
}

describe("ChatConversationHeader", () => {
  it("uses a stable desktop height before and after session materialization", () => {
    renderHeader();

    const header = screen.getByText("New Task").closest(".border-b");

    expect(header?.className).toContain("h-[52px]");
    expect(header?.className).not.toContain("transition-all");
  });

  it("uses the standard session-header action button density after the session is materialized", () => {
    renderHeader({
      title: "First message",
      actions: (
        <ChatSessionHeaderActions
          sessionKey="session-1"
          canDeleteSession
          isDeletePending={false}
          childSessionCount={0}
          sessionCronJobCount={0}
          onDeleteSession={vi.fn()}
        />
      ),
    });

    const moreActions = screen.getByRole("button", { name: "More actions" });
    const header = screen.getByText("First message").closest(".border-b");

    expect(header?.className).toContain("h-[52px]");
    expect(moreActions.className).toContain("h-7");
    expect(moreActions.className).toContain("w-7");
  });
});

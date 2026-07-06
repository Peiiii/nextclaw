import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ChatSessionWorkspacePanelContent } from "@/features/chat/features/workspace/components/chat-session-workspace-panel-content";
import type { ResolvedChildSessionTab } from "@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view";

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatThreadManager: {
      materializeSideChatDraft: vi.fn(),
      openFilePreview: vi.fn(),
    },
  }),
}));

vi.mock("@/features/chat/features/conversation/components/session-conversation-area", () => ({
  SessionConversationArea: () => <div data-testid="session-conversation-area" />,
}));

function createChildTab(): ResolvedChildSessionTab {
  return {
    sessionKey: "child-1",
    parentSessionKey: "parent-1",
    title: "Child title",
    agentId: "agent-1",
    updatedAt: null,
    lastMessageAt: null,
    readAt: null,
    runStatus: undefined,
    sessionTypeLabel: "原生",
    preferredModel: "minimax/MiniMax-M3",
    projectName: "nextbot",
    projectRoot: "/Users/peiwang/Projects/nextbot",
  };
}

it("shows compact child session metadata without repeating the tab title", () => {
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{
        kind: "child-session",
        tab: createChildTab(),
      }}
      filePreviewRefreshVersion={0}
      sessionCronJobs={[]}
      sessionProjectRoot={null}
      sessionWorkingDir={null}
    />,
  );

  expect(screen.queryByText("Child title")).toBeNull();
  expect(screen.getByText("原生")).toBeTruthy();
  expect(screen.getByText("minimax/MiniMax-M3")).toBeTruthy();
  expect(screen.getByText("nextbot")).toBeTruthy();
  expect(screen.getByTitle("/Users/peiwang/Projects/nextbot")).toBeTruthy();
});

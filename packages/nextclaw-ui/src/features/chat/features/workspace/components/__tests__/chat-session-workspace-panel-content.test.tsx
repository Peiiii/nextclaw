import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ChatSessionWorkspacePanelContent } from "@/features/chat/features/workspace/components/chat-session-workspace-panel-content";
import type { ResolvedChildSessionTab } from "@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view";

const mocks = vi.hoisted(() => ({
  materializeSideChatDraft: vi.fn(),
  openChildSessions: vi.fn(),
  openFilePreview: vi.fn(),
  openProjectFiles: vi.fn(),
  openSessionCronPanel: vi.fn(),
  selectChildSessionDetail: vi.fn(),
}));

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatThreadManager: {
      ...mocks,
    },
  }),
}));

vi.mock("@/features/chat/features/conversation/components/session-conversation-area", () => ({
  SessionConversationArea: () => <div data-testid="session-conversation-area" />,
}));

vi.mock("@/shared/hooks/use-server-path-browse", () => ({
  useServerPathBrowse: () => ({
    isLoading: false,
    error: null,
    data: {
      currentPath: "/Users/peiwang/Projects/nextbot",
      parentPath: "/Users/peiwang/Projects",
      homePath: "/Users/peiwang",
      breadcrumbs: [],
      entries: [
        {
          name: "src",
          path: "/Users/peiwang/Projects/nextbot/src",
          kind: "directory",
          hidden: false,
        },
      ],
    },
  }),
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
      childSessionTabs={[createChildTab()]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
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

it("shows all session workspace entries in the overview", async () => {
  const user = userEvent.setup();
  const childTab = createChildTab();

  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: "overview" }}
      childSessionTabs={[childTab]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/tmp/project"
      sessionWorkingDir="/tmp/project"
    />,
  );

  expect(screen.getByText("Overview")).toBeTruthy();
  const childSessionsButton = screen.getByRole("button", {
    name: /Child sessions/,
  });
  const cronJobsButton = screen.getByRole("button", {
    name: /Session cron jobs/,
  });

  expect((childSessionsButton as HTMLButtonElement).disabled).toBe(false);
  expect((cronJobsButton as HTMLButtonElement).disabled).toBe(false);

  await user.click(childSessionsButton);
  await user.click(cronJobsButton);
  await user.click(screen.getByRole("button", { name: /Project files/ }));

  expect(mocks.openChildSessions).toHaveBeenCalledWith("parent-1");
  expect(mocks.openSessionCronPanel).toHaveBeenCalledWith("parent-1");
  expect(mocks.openProjectFiles).toHaveBeenCalledWith("parent-1");
});

it("shows an empty child sessions page instead of disabling the entry", () => {
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: "child-sessions" }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot={null}
      sessionWorkingDir={null}
    />,
  );

  expect(screen.getByText("No child sessions yet.")).toBeTruthy();
});

it("shows the selected session project as a hierarchical file tree", () => {
  render(
    <ChatSessionWorkspacePanelContent
      activeSelection={{ kind: "project-files" }}
      childSessionTabs={[]}
      filePreviewRefreshVersion={0}
      sessionKey="parent-1"
      sessionCronJobs={[]}
      sessionProjectRoot="/Users/peiwang/Projects/nextbot"
      sessionWorkingDir="/Users/peiwang/Projects/nextbot"
    />,
  );

  expect(screen.getByRole("tree", { name: "Project files" })).toBeTruthy();
  expect(screen.getByText("nextbot")).toBeTruthy();
  expect(
    screen.getByRole("treeitem", { name: "Open directory: src" }),
  ).toBeTruthy();
});

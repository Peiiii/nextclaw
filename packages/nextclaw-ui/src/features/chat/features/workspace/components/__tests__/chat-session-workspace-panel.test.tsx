import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSessionWorkspacePanel } from "@/features/chat/features/workspace/components/chat-session-workspace-panel";
import type { ChatWorkspaceFileTab } from "@/features/chat/stores/chat-thread.store";
import type * as ReactQuery from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  syncVisibleWorkspaceSelection: vi.fn(),
  selectChildSessionDetail: vi.fn(),
  selectWorkspaceFile: vi.fn(),
  closeWorkspaceFile: vi.fn(),
  openSessionCronPanel: vi.fn(),
  goBackWorkspacePanel: vi.fn(),
  goForwardWorkspacePanel: vi.fn(),
  closeWorkspacePanel: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatThreadManager: mocks,
  }),
}));

vi.mock("@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view", () => ({
  useNcpChildSessionTabsView: () => [],
}));

vi.mock("@/features/chat/features/workspace/components/chat-session-workspace-panel-content", () => ({
  ChatSessionWorkspacePanelContent: ({
    activeSelection,
    filePreviewRefreshVersion,
  }: {
    activeSelection: { kind: string };
    filePreviewRefreshVersion: number;
  }) => (
    <div
      data-file-refresh-version={filePreviewRefreshVersion}
      data-testid="workspace-panel-content"
    >
      {activeSelection.kind}
    </div>
  ),
}));

function createWorkspaceFileTab(): ChatWorkspaceFileTab {
  return {
    key: "file-tab",
    parentSessionKey: "session-1",
    path: "README.md",
    viewMode: "preview",
  };
}

function renderPanel() {
  const fileTab = createWorkspaceFileTab();

  return render(
    <ChatSessionWorkspacePanel
      sessionKey="session-1"
      childSessionTabs={[]}
      activeChildSessionKey={null}
      activeSideChatDraft={null}
      workspaceFileTabs={[fileTab]}
      activeWorkspaceFileKey={fileTab.key}
      workspaceNavigationHistory={[{ kind: "file", key: fileTab.key }]}
      workspaceNavigationHistoryIndex={0}
      activePanelKind="file"
      sessionCronJobs={[]}
      sessionProjectRoot={null}
      sessionWorkingDir={null}
    />,
  );
}

describe("ChatSessionWorkspacePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes the active workspace file from the top action bar", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Refresh file" }));

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["server-path-read", "README.md", null],
    });
    expect(
      screen
        .getByTestId("workspace-panel-content")
        .getAttribute("data-file-refresh-version"),
    ).toBe("1");
  });
});

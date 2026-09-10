import { getPresenter } from '@/app/presenters/app.presenter';
import { buildSessionPath } from '@/features/chat/features/session/utils/chat-session-route.utils';
import { AppPresenterProvider } from '@/app/components/app-presenter-provider';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/features/panel-apps/hooks/use-panel-apps', () => ({
  usePanelApps: () => ({ data: { entries: [] } }),
  useUpdatePanelAppPreferences: () => ({ mutate: vi.fn(), isPending: false }),
}));
function render(ui: ReactElement) {
  return renderUi(<AppPresenterProvider><MemoryRouter initialEntries={[buildSessionPath('session-1')]}>{ui}</MemoryRouter></AppPresenterProvider>);
}
import { useWorkbenchSurfaceStore } from '@/shared/components/workbench/stores/workbench-surface.store';
import { render as renderUi, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSessionWorkspacePanel } from "@/features/chat/features/workspace/components/chat-session-workspace-panel";
import { WorkspaceTabsBar } from "@/features/chat/features/workspace/components/chat-session-workspace-panel-nav";
import type { ChatWorkspaceFileTab } from "@/features/chat/stores/chat-thread.store";
import type * as ReactQuery from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  syncVisibleWorkspaceSelection: vi.fn(),
  selectChildSessionDetail: vi.fn(),
  selectWorkspaceFile: vi.fn(),
  closeWorkspaceTab: vi.fn(),
  openSessionCronPanel: vi.fn(),
  goBackWorkspacePanel: vi.fn(),
  goForwardWorkspacePanel: vi.fn(),
  closeWorkspacePanel: vi.fn(),
  setWorkspacePanelWidth: vi.fn(),
  invalidateQueries: vi.fn(),
  requestFileReference: vi.fn(),
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
    chatComposerIntentManager: {
      requestFileReference: mocks.requestFileReference,
    },
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

function renderPanel(displayMode: "docked" | "overlay" = "docked") {
  const fileTab = createWorkspaceFileTab();

  return render(
    <ChatSessionWorkspacePanel
      sessionKey="session-1"
      childSessionTabs={[]}
      activeChildSessionKey={null}
      activeSideChatDraft={null}
      workspaceFileTabs={[fileTab]}
      activeWorkspaceFileKey={fileTab.key}
      closedWorkspaceTabEntries={[]}
      workspaceNavigationHistory={[{ kind: "file", key: fileTab.key }]}
      workspaceNavigationHistoryIndex={0}
      activePanelKind="file"
      sessionCronJobs={[]}
      sessionProjectRoot="/workspace"
      sessionWorkingDir={null}
      displayMode={displayMode}
    />,
  );
}

describe("ChatSessionWorkspacePanel", () => {
  beforeEach(() => {
    useWorkbenchSurfaceStore.setState({ surfaces: {} });
    vi.clearAllMocks();
    vi.spyOn(getPresenter().chatComposerIntentManager, 'requestFileReference').mockImplementation(mocks.requestFileReference);
  });

  it("refreshes the active workspace file from the top action bar", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Refresh preview" }));

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["server-path-read", "README.md", null, null],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["server-path-browse", "README.md", "", true],
    });
    expect(
      screen
        .getByTestId("workspace-panel-content")
        .getAttribute("data-file-refresh-version"),
    ).toBe("1");
  });

  it("shows more actions for a child-session workspace tab", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceTabsBar
        canGoBack={false}
        canGoForward={false}
        tabs={[
          {
            key: "child:child-1",
            kind: "child-session",
            title: "Child session",
            tooltip: "Child session",
            active: true,
            sessionKey: "child-1",
            onSelect: vi.fn(),
          },
        ]}
        onGoBack={vi.fn()}
        onGoForward={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Page actions: Child session" }));

    expect(screen.getByRole("menuitem", { name: "Copy session ID" })).toBeTruthy();
  });

  it("shows the running spinner on workspace tabs", () => {
    render(
      <WorkspaceTabsBar
        canGoBack={false}
        canGoForward={false}
        tabs={[
          {
            key: "child-sessions",
            kind: "child-sessions",
            title: "Child sessions",
            tooltip: "Child sessions",
            active: true,
            runStatus: "running",
            onSelect: vi.fn(),
          },
        ]}
        onClose={vi.fn()}
        onGoBack={vi.fn()}
        onGoForward={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Running")).toBeTruthy();
  });

  it("adds an opened project file to the active chat from its action menu", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(
      screen.getByRole("button", { name: "Page actions: Preview: README.md" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Add to chat" }));

    expect(mocks.requestFileReference).toHaveBeenCalledWith({
      targetSessionKey: "session-1",
      tokenKey: "README.md",
      label: "README.md",
    });
  });

  it("maximizes and restores the docked workspace panel within its container", async () => {
    const user = userEvent.setup();
    renderPanel();

    const panel = screen.getByTestId("chat-session-workspace-panel");
    expect(panel.className).not.toContain("absolute");
    expect(panel.getAttribute("data-theme-surface")).toBe("workspace-panel");

    await user.click(
      screen.getByRole("button", { name: "Maximize" }),
    );

    expect(panel.style.position).toBe("fixed");
    expect(panel.style.position).toBe("fixed");
    expect(
      screen.queryByTestId("resizable-right-panel-handle"),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Restore size" }),
    );

    expect(panel.className).not.toContain("absolute");
    expect(screen.getByTestId("resizable-right-panel-handle")).toBeTruthy();
  });

  it("does not show a redundant maximize action in viewport overlay mode", () => {
    renderPanel("overlay");

    expect(
      screen.queryByRole("button", { name: "Maximize" }),
    ).toBeNull();
    expect(screen.getByTestId("chat-session-workspace-panel").style.position).toBe("fixed");
  });
});

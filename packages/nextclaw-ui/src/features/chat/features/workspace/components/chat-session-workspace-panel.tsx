import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CronJobView } from "@/shared/lib/api";
import { useNcpChildSessionTabsView } from "@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import {
  CHAT_WORKSPACE_PANEL_DEFAULT_WIDTH,
  CHAT_WORKSPACE_PANEL_MAX_WIDTH,
  CHAT_WORKSPACE_PANEL_MIN_WIDTH,
} from "@/features/chat/features/workspace/utils/chat-workspace-panel-layout.utils";
import type {
  ChatChildSessionTab,
  ChatWorkspacePanelKind,
  ChatWorkspaceSideChatDraft,
  ChatWorkspaceNavigationEntry,
  ChatWorkspaceFileTab,
} from "@/features/chat/stores/chat-thread.store";
import {
  buildWorkspaceTabsViewModel,
  resolveWorkspaceSelection,
  type WorkspaceTabViewModel,
} from "@/features/chat/features/workspace/utils/chat-workspace-panel-view-model.utils";
import { WorkspaceTabsBar } from "./chat-session-workspace-panel-nav";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { ChatSessionWorkspacePanelContent } from "@/features/chat/features/workspace/components/chat-session-workspace-panel-content";
import { ResizableRightPanel } from "@/shared/components/resizable-right-panel/resizable-right-panel";
import { cn } from "@/shared/lib/utils";
import {
  canGoBackInNavigationHistory,
  canGoForwardInNavigationHistory,
} from "@/shared/lib/navigation-history";
import { buildServerPathBrowseQueryKey } from "@/shared/hooks/use-server-path-browse";
import { buildServerPathReadQueryKey } from "@/shared/hooks/use-server-path-read";

type ChatSessionWorkspacePanelProps = {
  sessionKey: string | null;
  childSessionTabs: readonly ChatChildSessionTab[];
  activeChildSessionKey: string | null;
  activeSideChatDraft: ChatWorkspaceSideChatDraft | null;
  workspaceFileTabs: readonly ChatWorkspaceFileTab[];
  activeWorkspaceFileKey: string | null;
  workspaceNavigationHistory?: readonly ChatWorkspaceNavigationEntry[];
  workspaceNavigationHistoryIndex?: number;
  activePanelKind?: ChatWorkspacePanelKind | null;
  sessionCronJobs?: readonly CronJobView[];
  sessionProjectRoot: string | null;
  sessionWorkingDir: string | null;
  workspacePanelWidth?: number;
  displayMode?: "docked" | "overlay";
};

export function ChatSessionWorkspacePanel({
  sessionKey,
  childSessionTabs,
  activeChildSessionKey,
  activeSideChatDraft,
  workspaceFileTabs,
  activeWorkspaceFileKey,
  workspaceNavigationHistory = [],
  workspaceNavigationHistoryIndex = 0,
  activePanelKind,
  sessionCronJobs = [],
  sessionProjectRoot,
  sessionWorkingDir,
  workspacePanelWidth = CHAT_WORKSPACE_PANEL_DEFAULT_WIDTH,
  displayMode = "docked",
}: ChatSessionWorkspacePanelProps) {
  const presenter = usePresenter();
  const queryClient = useQueryClient();
  const [isMaximized, setIsMaximized] = useState(false);
  const [filePreviewRefreshVersion, setFilePreviewRefreshVersion] = useState(0);
  const resolvedChildTabs = useNcpChildSessionTabsView(childSessionTabs);
  const optimisticReadAtBySessionKey = useChatSessionListStore(
    (state) => state.optimisticReadAtBySessionKey,
  );
  const activeSelection = resolveWorkspaceSelection({
    activeChildSessionKey,
    activeSideChatDraft,
    activeWorkspaceFileKey,
    activePanelKind,
    childSessionTabs: resolvedChildTabs,
    workspaceFileTabs,
  });
  const workspaceHistory = {
    entries: workspaceNavigationHistory,
    index: workspaceNavigationHistoryIndex,
  };

  useEffect(() => {
    presenter.chatThreadManager.syncVisibleWorkspaceSelection(activeSelection);
  }, [activeSelection, presenter]);

  const workspaceTabs = useMemo<WorkspaceTabViewModel[]>(
    () =>
      buildWorkspaceTabsViewModel({
        resolvedChildTabs,
        activeSideChatDraft,
        workspaceFileTabs,
        activeSelection,
        optimisticReadAtBySessionKey,
        onSelectSession: presenter.chatThreadManager.selectChildSessionDetail,
        onSelectFile: presenter.chatThreadManager.selectWorkspaceFile,
        onOpenFileViewer: presenter.chatThreadManager.openWorkspaceFileViewer,
        onCloseFile: presenter.chatThreadManager.closeWorkspaceFile,
        onSelectOverview: () => {
          if (sessionKey)
            presenter.chatThreadManager.openWorkspaceOverview(sessionKey);
        },
        onSelectChildSessions: () => {
          if (sessionKey)
            presenter.chatThreadManager.openChildSessions(sessionKey);
        },
        onSelectProjectFiles: () => {
          if (sessionKey)
            presenter.chatThreadManager.openProjectFiles(sessionKey);
        },
        onSelectCronJobs: () => {
          if (sessionKey)
            presenter.chatThreadManager.openSessionCronPanel(sessionKey);
        },
      }),
    [
      activeSelection,
      activeSideChatDraft,
      optimisticReadAtBySessionKey,
      presenter.chatThreadManager,
      resolvedChildTabs,
      sessionKey,
      workspaceFileTabs,
    ],
  );

  if (!activeSelection) {
    return null;
  }

  const isContainerMaximized = displayMode === "docked" && isMaximized;
  const isOverlayPanel = displayMode === "overlay" || isContainerMaximized;
  const activeFile =
    activeSelection.kind === "file" && activeSelection.file.viewMode === "preview"
      ? activeSelection.file
      : null;
  const refreshActiveFile = activeFile
    ? () => {
        void queryClient.invalidateQueries({
          queryKey: buildServerPathReadQueryKey({
            path: activeFile.path,
            basePath: sessionWorkingDir,
          }),
        });
        void queryClient.invalidateQueries({
          queryKey: buildServerPathBrowseQueryKey({
            path: activeFile.path,
            basePath: sessionWorkingDir,
            includeFiles: true,
          }),
        });
        setFilePreviewRefreshVersion((value) => value + 1);
      }
    : undefined;

  return (
    <ResizableRightPanel
      data-testid="chat-session-workspace-panel"
      className={cn(
        isOverlayPanel
          ? "bg-white"
          : "hidden border-gray-200/70 bg-white/95 backdrop-blur-sm md:flex",
        isContainerMaximized ? "shadow-xl" : null,
      )}
      defaultWidth={workspacePanelWidth}
      width={workspacePanelWidth}
      minWidth={CHAT_WORKSPACE_PANEL_MIN_WIDTH}
      maxWidth={CHAT_WORKSPACE_PANEL_MAX_WIDTH}
      onWidthCommit={presenter.chatThreadManager.setWorkspacePanelWidth}
      overlay={isOverlayPanel}
      overlayScope={isContainerMaximized ? "container" : "viewport"}
    >
      <WorkspaceTabsBar
        tabs={workspaceTabs}
        canGoBack={canGoBackInNavigationHistory(workspaceHistory)}
        canGoForward={canGoForwardInNavigationHistory(workspaceHistory)}
        isMaximized={isContainerMaximized}
        onGoBack={presenter.chatThreadManager.goBackWorkspacePanel}
        onGoForward={presenter.chatThreadManager.goForwardWorkspacePanel}
        onRefreshFile={refreshActiveFile}
        onToggleMaximize={
          displayMode === "docked"
            ? () => setIsMaximized((value) => !value)
            : undefined
        }
        onClose={presenter.chatThreadManager.closeWorkspacePanel}
      />

      <div className="flex min-h-0 flex-1 flex-col bg-white">
        <ChatSessionWorkspacePanelContent
          activeSelection={activeSelection}
          childSessionTabs={resolvedChildTabs}
          filePreviewRefreshVersion={filePreviewRefreshVersion}
          sessionKey={sessionKey}
          sessionCronJobs={sessionCronJobs}
          sessionProjectRoot={sessionProjectRoot}
          sessionWorkingDir={sessionWorkingDir}
        />
      </div>
    </ResizableRightPanel>
  );
}

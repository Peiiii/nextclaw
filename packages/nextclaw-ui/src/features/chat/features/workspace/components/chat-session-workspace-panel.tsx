import { useEffect, useMemo } from "react";
import type { CronJobView } from "@/shared/lib/api";
import { useNcpChildSessionTabsView } from "@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import type {
  ChatChildSessionTab,
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

type ChatSessionWorkspacePanelProps = {
  sessionKey: string | null;
  childSessionTabs: readonly ChatChildSessionTab[];
  activeChildSessionKey: string | null;
  workspaceFileTabs: readonly ChatWorkspaceFileTab[];
  activeWorkspaceFileKey: string | null;
  workspaceNavigationHistory?: readonly ChatWorkspaceNavigationEntry[];
  workspaceNavigationHistoryIndex?: number;
  activePanelKind?: "child-session" | "file" | "cron" | null;
  sessionCronJobs?: readonly CronJobView[];
  sessionProjectRoot: string | null;
  sessionWorkingDir: string | null;
  displayMode?: "docked" | "overlay";
};

export function ChatSessionWorkspacePanel({
  sessionKey,
  childSessionTabs,
  activeChildSessionKey,
  workspaceFileTabs,
  activeWorkspaceFileKey,
  workspaceNavigationHistory = [],
  workspaceNavigationHistoryIndex = 0,
  activePanelKind,
  sessionCronJobs = [],
  sessionProjectRoot,
  sessionWorkingDir,
  displayMode = "docked",
}: ChatSessionWorkspacePanelProps) {
  const presenter = usePresenter();
  const resolvedChildTabs = useNcpChildSessionTabsView(childSessionTabs);
  const optimisticReadAtBySessionKey = useChatSessionListStore(
    (state) => state.optimisticReadAtBySessionKey,
  );
  const activeSelection = resolveWorkspaceSelection({
    activeChildSessionKey,
    activeWorkspaceFileKey,
    activePanelKind,
    childSessionTabs: resolvedChildTabs,
    workspaceFileTabs,
    sessionCronJobCount: sessionCronJobs.length,
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
        workspaceFileTabs,
        sessionCronJobCount: sessionCronJobs.length,
        activeSelection,
        optimisticReadAtBySessionKey,
        onSelectSession: presenter.chatThreadManager.selectChildSessionDetail,
        onSelectFile: presenter.chatThreadManager.selectWorkspaceFile,
        onCloseFile: presenter.chatThreadManager.closeWorkspaceFile,
        onSelectCronJobs: () => {
          if (sessionKey)
            presenter.chatThreadManager.openSessionCronPanel(sessionKey);
        },
      }),
    [
      activeSelection,
      optimisticReadAtBySessionKey,
      presenter.chatThreadManager,
      resolvedChildTabs,
      sessionKey,
      workspaceFileTabs,
      sessionCronJobs.length,
    ],
  );

  if (!activeSelection) {
    return null;
  }

  return (
    <ResizableRightPanel
      className={cn(
        displayMode === "overlay"
          ? "bg-white"
          : "hidden border-gray-200/70 bg-white/95 backdrop-blur-sm md:flex",
      )}
      defaultWidth={480}
      minWidth={360}
      maxWidth={860}
      overlay={displayMode === "overlay"}
    >
      <WorkspaceTabsBar
        tabs={workspaceTabs}
        canGoBack={canGoBackInNavigationHistory(workspaceHistory)}
        canGoForward={canGoForwardInNavigationHistory(workspaceHistory)}
        onGoBack={presenter.chatThreadManager.goBackWorkspacePanel}
        onGoForward={presenter.chatThreadManager.goForwardWorkspacePanel}
        onClose={presenter.chatThreadManager.closeWorkspacePanel}
      />

      <div className="flex min-h-0 flex-1 flex-col bg-white">
        <ChatSessionWorkspacePanelContent
          activeSelection={activeSelection}
          sessionCronJobs={sessionCronJobs}
          sessionProjectRoot={sessionProjectRoot}
          sessionWorkingDir={sessionWorkingDir}
        />
      </div>
    </ResizableRightPanel>
  );
}

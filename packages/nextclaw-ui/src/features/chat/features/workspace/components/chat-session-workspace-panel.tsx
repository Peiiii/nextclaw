import { usePageResourceActions } from '@/features/right-panel-resources';
import { pageResourceFromTarget } from '@/features/right-panel-resources';
import { createWorkspaceFilePanelTarget } from '@/features/chat/features/workspace/utils/workspace-file-panel-route.utils';
import { buildSessionPanelUrl } from '@/features/chat/features/session/utils/chat-session-route.utils';
import { sessionSurfaceManager } from '@/features/chat/managers/session-surface.manager';
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
import { WorkbenchSurface } from "@/shared/components/workbench/workbench-surface";
import { getAppPresenter } from "@/app/presenters/app.presenter";
import { t } from "@/shared/lib/i18n";
import {
  canGoBackInNavigationHistory,
  canGoForwardInNavigationHistory,
} from "@/shared/lib/navigation-history";
import { buildServerPathBrowseQueryKey } from "@/shared/hooks/use-server-path-browse";
import { buildServerPathReadQueryKey } from "@/shared/hooks/use-server-path-read";

type ChatSessionWorkspacePanelProps = {
  sessionKey: string | null;
  hidden?: boolean;
  childSessionTabs: readonly ChatChildSessionTab[];
  activeChildSessionKey: string | null;
  activeSideChatDraft: ChatWorkspaceSideChatDraft | null;
  workspaceFileTabs: readonly ChatWorkspaceFileTab[];
  activeWorkspaceFileKey: string | null;
  closedWorkspaceTabEntries: readonly ChatWorkspaceNavigationEntry[];
  workspaceNavigationHistory?: readonly ChatWorkspaceNavigationEntry[];
  workspaceNavigationHistoryIndex?: number;
  activePanelKind?: ChatWorkspacePanelKind | null;
  sessionCronJobs?: readonly CronJobView[];
  sessionCronJobsError?: boolean;
  sessionCronJobsLoading?: boolean;
  onRetrySessionCronJobs?: () => void;
  sessionProjectRoot: string | null;
  sessionWorkingDir: string | null;
  workspacePanelWidth?: number;
  displayMode?: "docked" | "overlay";
};

export function ChatSessionWorkspacePanel({
  sessionKey,
  hidden = false,
  childSessionTabs,
  activeChildSessionKey,
  activeSideChatDraft,
  workspaceFileTabs,
  activeWorkspaceFileKey,
  closedWorkspaceTabEntries,
  workspaceNavigationHistory = [],
  workspaceNavigationHistoryIndex = 0,
  activePanelKind,
  sessionCronJobs = [],
  sessionCronJobsError = false,
  sessionCronJobsLoading = false,
  onRetrySessionCronJobs,
  sessionProjectRoot,
  sessionWorkingDir,
  workspacePanelWidth = CHAT_WORKSPACE_PANEL_DEFAULT_WIDTH,
  displayMode = "docked",
}: ChatSessionWorkspacePanelProps) {
  const presenter = usePresenter();
  const pageActions = usePageResourceActions();
  const queryClient = useQueryClient();
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
        hasSession: Boolean(sessionKey),
        resolvedChildTabs,
        activeSideChatDraft,
        closedWorkspaceTabEntries,
        workspaceFileTabs,
        activeSelection,
        optimisticReadAtBySessionKey,
        sessionProjectRoot: sessionProjectRoot ?? sessionWorkingDir,
        onAddFileToChat: ({ label, tokenKey }) => {
          presenter.chatComposerIntentManager.requestFileReference({
            targetSessionKey: sessionKey,
            tokenKey,
            label,
          });
        },
        onSelectSession: presenter.chatThreadManager.selectChildSessionDetail,
        onSelectFile: presenter.chatThreadManager.selectWorkspaceFile,
        onOpenFileViewer: presenter.chatThreadManager.openWorkspaceFileViewer,
        onCloseTab: presenter.chatThreadManager.closeWorkspaceTab,
        onSelectOverview: () => {
          if (sessionKey)
            presenter.chatThreadManager.openWorkspaceOverview(sessionKey);
        },
        onSelectChildSessions: () => {
          if (sessionKey)
            presenter.chatThreadManager.openChildSessions(sessionKey);
        },
        onSelectProjectFiles: () => {
          presenter.chatThreadManager.openProjectFiles(sessionKey);
        },
        onSelectCronJobs: () => {
          if (sessionKey)
            presenter.chatThreadManager.openSessionCronPanel(sessionKey);
        },
        onSelectContinuousAttention: () => {
          if (sessionKey)
            presenter.chatThreadManager.openContinuousAttention(sessionKey);
        },
      }),
    [
      activeSelection,
      activeSideChatDraft,
      closedWorkspaceTabEntries,
      optimisticReadAtBySessionKey,
      presenter.chatThreadManager,
      presenter.chatComposerIntentManager,
      resolvedChildTabs,
      sessionKey,
      sessionProjectRoot,
      sessionWorkingDir,
      workspaceFileTabs,
    ],
  );

  if (!activeSelection) {
    return null;
  }

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
    <WorkbenchSurface
      id={`session-workspace:${sessionKey ?? 'draft'}`} manager={getAppPresenter().workbenchSurfaceManager}
      title={t('workbenchSessionGroup')} testId="chat-session-workspace-panel" hidden={hidden}
      width={workspacePanelWidth} minWidth={CHAT_WORKSPACE_PANEL_MIN_WIDTH} maxWidth={CHAT_WORKSPACE_PANEL_MAX_WIDTH}
      onWidthCommit={presenter.chatThreadManager.setWorkspacePanelWidth}
      fullscreen={displayMode === "overlay"} onClose={presenter.chatThreadManager.closeWorkspacePanel} closeLabel={t('workbenchHideGroup')}
      navigation={
      <WorkspaceTabsBar
        tabs={workspaceTabs.map((tab) => ({
          ...tab,
          menuGroups: (() => {
            const file = workspaceFileTabs.find((item) => `file:${item.key}` === tab.key);
            const target = file ? createWorkspaceFilePanelTarget(file, { workingDir: sessionWorkingDir, projectRoot: sessionProjectRoot })
              : tab.sessionKey ? { kind: 'chat-session', title: tab.title, url: buildSessionPanelUrl(tab.sessionKey), resourceUri: buildSessionPanelUrl(tab.sessionKey), historyPolicy: 'none' as const } : tab.kind !== 'side-chat-draft' ? { kind: 'workspace', title: tab.title, url: `nextclaw://workspace?${new URLSearchParams({ session: sessionKey ?? '', page: tab.kind })}`, historyPolicy: 'none' as const } : null;
            return target ? [...(tab.menuGroups ?? []), ...pageActions(pageResourceFromTarget(target), 'workspace')] : tab.menuGroups;
          })(),
          onMoveGlobal: tab.kind === 'file' ? () => presenter.chatThreadManager.moveFileToGlobal(tab.key.slice('file:'.length), { workingDir: sessionWorkingDir, projectRoot: sessionProjectRoot }, getAppPresenter().docBrowserManager)
            : tab.kind === 'child-session' && tab.sessionKey ? () => {
              sessionSurfaceManager.dock({ sessionKey: tab.sessionKey!, title: tab.title }, getAppPresenter().docBrowserManager);
              tab.onClose?.();
            } : undefined,
          onFloat: tab.kind === 'child-session' && tab.sessionKey ? () => {
            sessionSurfaceManager.open({ sessionKey: tab.sessionKey!, title: tab.title });
            tab.onClose?.();
          } : undefined,
        }))}
        canGoBack={canGoBackInNavigationHistory(workspaceHistory)}
        canGoForward={canGoForwardInNavigationHistory(workspaceHistory)}
        onGoBack={presenter.chatThreadManager.goBackWorkspacePanel}
        onGoForward={presenter.chatThreadManager.goForwardWorkspacePanel}
        onRefreshFile={refreshActiveFile}

      />
      }
    >

      <div className="flex min-h-0 flex-1 flex-col bg-card">
        <ChatSessionWorkspacePanelContent
          activeSelection={activeSelection}
          childSessionTabs={resolvedChildTabs}
          filePreviewRefreshVersion={filePreviewRefreshVersion}
          sessionKey={sessionKey}
          sessionCronJobs={sessionCronJobs}
          sessionCronJobsError={sessionCronJobsError}
          sessionCronJobsLoading={sessionCronJobsLoading}
          onRetrySessionCronJobs={onRetrySessionCronJobs}
          sessionProjectRoot={sessionProjectRoot}
          sessionWorkingDir={sessionWorkingDir}
        />
      </div>
    </WorkbenchSurface>
  );
}

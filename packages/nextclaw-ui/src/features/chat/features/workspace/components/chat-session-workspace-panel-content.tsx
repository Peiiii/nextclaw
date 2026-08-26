import type { ReactNode } from 'react';
import type { ChatFileOpenActionViewModel } from '@nextclaw/agent-chat-ui';
import {
  AlarmClock,
  ChevronRight,
  Eye,
  FolderTree,
  GitBranch,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { CronJobView } from '@/shared/lib/api';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import { SessionConversationArea } from '@/features/chat/features/conversation/components/session-conversation-area';
import { ChatSessionWorkspaceFilePreview } from '@/features/chat/features/workspace/components/chat-session-workspace-file-preview';
import { ChatSessionWorkspaceDirectoryBrowser } from '@/features/chat/features/workspace/components/chat-session-workspace-directory-browser';
import { SessionCronJobContent } from '@/features/chat/features/workspace/components/session-cron-job-content';
import { ChatSessionChildSessions } from '@/features/chat/features/workspace/components/child-sessions/chat-session-child-sessions';
import { ChatSessionTokenUsage } from '@/features/chat/features/workspace/components/overview/chat-session-token-usage';
import { ChatSessionContinuousAttention } from '@/features/chat/features/workspace/components/overview/chat-session-continuous-attention';
import { useNcpSessionObservations } from '@/features/chat/features/ncp/hooks/use-ncp-session-queries';
import type { ResolvedChildSessionTab } from '@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view';
import type { WorkspaceSelection } from '@/features/chat/features/workspace/utils/chat-workspace-panel-view-model.utils';
import { useServerPathBrowse } from '@/shared/hooks/use-server-path-browse';
import {
  CHAT_WORKSPACE_EXPLORER_MAX_WIDTH,
  CHAT_WORKSPACE_EXPLORER_MIN_WIDTH,
} from '@/features/chat/features/workspace/utils/chat-workspace-panel-layout.utils';
import { useWorkspaceExplorerLayout } from '@/features/chat/features/workspace/hooks/use-workspace-explorer-layout';
import { t } from '@/shared/lib/i18n';
import { resolveWorkspaceRelativePath } from '@/shared/lib/session-project';
import { cn } from '@/shared/lib/utils';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';

type ChatSessionWorkspacePanelContentProps = {
  activeSelection: WorkspaceSelection;
  childSessionTabs: readonly ResolvedChildSessionTab[];
  filePreviewRefreshVersion: number;
  sessionKey: string | null;
  sessionCronJobs: readonly CronJobView[];
  sessionCronJobsError?: boolean;
  sessionCronJobsLoading?: boolean;
  sessionProjectRoot: string | null;
  sessionWorkingDir: string | null;
  onRetrySessionCronJobs?: () => void;
};

function WorkspaceOverviewEntry({
  count,
  description,
  icon,
  onClick,
  title,
}: {
  count?: number;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-3 rounded-lg border border-gray-200/80 bg-white px-3 py-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
      onClick={onClick}
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <span className="truncate">{title}</span>
          {typeof count === 'number' ? (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-500">
              {count}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-gray-500">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
    </button>
  );
}

function WorkspaceOverview({
  childSessionTabs,
  sessionCronJobs,
  sessionKey,
}: {
  childSessionTabs: readonly ResolvedChildSessionTab[];
  sessionCronJobs: readonly CronJobView[];
  sessionKey: string | null;
}) {
  const presenter = usePresenter();
  const observationsQuery = useNcpSessionObservations(sessionKey);

  return (
    <div className="h-full overflow-auto bg-gray-50/45 px-4 py-5 custom-scrollbar">
      <div className="mx-auto max-w-xl">
        <h2 className="text-base font-semibold text-gray-900">{t('chatWorkspaceOverview')}</h2>
        <p className="mt-1 text-xs leading-5 text-gray-500">{t('chatWorkspaceOverviewDescription')}</p>
        <div className="mt-4 space-y-2">
          <WorkspaceOverviewEntry
            count={observationsQuery.data?.counts.total ?? 0}
            description={t('chatWorkspaceContinuousAttentionDescription')}
            icon={<Eye className="h-4 w-4" />}
            title={t('chatWorkspaceContinuousAttention')}
            onClick={() => {
              if (sessionKey) {
                presenter.chatThreadManager.openContinuousAttention(sessionKey);
              }
            }}
          />
          <WorkspaceOverviewEntry
            count={childSessionTabs.length}
            description={t('chatWorkspaceChildSessionsDescription')}
            icon={<GitBranch className="h-4 w-4" />}
            title={t('chatWorkspaceChildSessions')}
            onClick={() => {
              if (sessionKey) {
                presenter.chatThreadManager.openChildSessions(sessionKey);
              }
            }}
          />
          <WorkspaceOverviewEntry
            count={sessionCronJobs.length}
            description={t('chatWorkspaceSessionCronJobsDescription')}
            icon={<AlarmClock className="h-4 w-4" />}
            title={t('chatWorkspaceSessionCronJobs')}
            onClick={() => {
              if (sessionKey) {
                presenter.chatThreadManager.openSessionCronPanel(sessionKey);
              }
            }}
          />
          <WorkspaceOverviewEntry
            description={t('chatWorkspaceProjectFilesDescription')}
            icon={<FolderTree className="h-4 w-4" />}
            title={t('chatWorkspaceProjectFiles')}
            onClick={() => {
              if (sessionKey) {
                presenter.chatThreadManager.openProjectFiles(sessionKey);
              }
            }}
          />
        </div>
        <ChatSessionTokenUsage sessionKey={sessionKey} />
      </div>
    </div>
  );
}

function WorkspaceProjectFiles({
  activePath,
  onFileOpen,
  projectRoot,
  sessionKey,
  workingDir,
}: {
  activePath: string | null;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  projectRoot: string | null;
  sessionKey: string | null;
  workingDir: string | null;
}) {
  const presenter = usePresenter();
  const rootPath = projectRoot ?? workingDir;
  const browseQuery = useServerPathBrowse({
    path: rootPath,
    includeFiles: true,
    enabled: Boolean(rootPath),
  });

  if (!rootPath) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-500">
        {t('chatWorkspaceProjectFilesUnavailable')}
      </div>
    );
  }

  return (
    <ChatSessionWorkspaceDirectoryBrowser
      activeRelativePath={
        activePath ? resolveWorkspaceRelativePath({ path: activePath, sessionProjectRoot: rootPath }) : null
      }
      key={rootPath}
      browseQuery={browseQuery}
      onFileOpen={onFileOpen ?? presenter.chatThreadManager.openFilePreview}
      sessionKey={sessionKey}
      renderStatus={({ text, tone = 'muted' }) => (
        <div
          className={cn(
            'flex h-full items-center justify-center px-6 text-center text-sm',
            tone === 'error' ? 'text-rose-600' : 'text-gray-500',
          )}
        >
          {text}
        </div>
      )}
      showRoot
    />
  );
}

function WorkspaceSideChatDraftHeader() {
  return (
    <div className="border-b border-gray-200/70 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-900">
        <MessageSquarePlus className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">{t('chatWorkspaceSideChatDraftTitle')}</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-gray-500">{t('chatWorkspaceSideChatDraftSubtitle')}</p>
    </div>
  );
}

function WorkspaceSelectedContent({
  activeSelection,
  childSessionTabs,
  filePreviewRefreshVersion,
  sessionKey,
  sessionCronJobs,
  sessionCronJobsError = false,
  sessionCronJobsLoading = false,
  sessionProjectRoot,
  sessionWorkingDir,
  onRetrySessionCronJobs,
  explorerControl,
}: ChatSessionWorkspacePanelContentProps & {
  explorerControl?: { open: boolean; onToggle: () => void };
}) {
  const presenter = usePresenter();

  if (activeSelection.kind === 'overview') {
    return (
      <WorkspaceOverview
        childSessionTabs={childSessionTabs}
        sessionCronJobs={sessionCronJobs}
        sessionKey={sessionKey}
      />
    );
  }

  if (activeSelection.kind === 'child-sessions') {
    return <ChatSessionChildSessions childSessionTabs={childSessionTabs} sessionKey={sessionKey} />;
  }

  if (activeSelection.kind === 'continuous-attention') {
    return <ChatSessionContinuousAttention sessionKey={sessionKey} />;
  }

  if (activeSelection.kind === 'side-chat-draft') {
    return (
      <>
        <WorkspaceSideChatDraftHeader />
        <div className="flex min-h-0 flex-1 flex-col">
          <SessionConversationArea
            materializationContext={{
              kind: 'child',
              parentSessionKey: activeSelection.draft.parentSessionKey,
              inheritContext: true,
            }}
            sessionKey={null}
            showWelcomeForDraft={false}
            onSessionMaterialized={(sessionKey) =>
              presenter.chatThreadManager.materializeSideChatDraft({
                draftKey: activeSelection.draft.draftKey,
                sessionKey,
              })
            }
          />
        </div>
      </>
    );
  }

  if (activeSelection.kind === 'child-session') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <SessionConversationArea sessionKey={activeSelection.tab.sessionKey} />
      </div>
    );
  }

  if (activeSelection.kind === 'file') {
    return (
      <ChatSessionWorkspaceFilePreview
        breadcrumbLeading={
          <IconActionButton
            data-testid="workspace-explorer-toggle"
            icon={
              explorerControl?.open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />
            }
            label={t(explorerControl?.open ? 'chatWorkspaceHideProjectFiles' : 'chatWorkspaceShowProjectFiles')}
            size="sm"
            tooltipSide="bottom"
            onClick={explorerControl?.onToggle}
          />
        }
        file={activeSelection.file}
        refreshVersion={filePreviewRefreshVersion}
        sessionProjectRoot={sessionProjectRoot}
        sessionWorkingDir={sessionWorkingDir}
        onFileOpen={presenter.chatThreadManager.openFilePreview}
        onTextExcerptAdd={(excerpt) => {
          presenter.chatComposerIntentManager.requestExcerptReference({
            targetSessionKey: sessionKey,
            ...excerpt,
          });
        }}
      />
    );
  }

  return (
    <SessionCronJobContent
      jobs={sessionCronJobs}
      isError={sessionCronJobsError}
      isLoading={sessionCronJobsLoading}
      onRetry={onRetrySessionCronJobs}
    />
  );
}

export function ChatSessionWorkspacePanelContent({
  activeSelection,
  sessionKey,
  sessionProjectRoot,
  sessionWorkingDir,
  ...selectedContentProps
}: ChatSessionWorkspacePanelContentProps) {
  const projectFilesActive = activeSelection.kind === 'project-files';
  const fileActive = activeSelection.kind === 'file';
  const presenter = usePresenter();
  const {
    compact,
    containerRef,
    explorerOpen,
    explorerOverlay,
    explorerWidth,
    onResizeStart,
    setExplorerOpen,
    showExplorer,
  } = useWorkspaceExplorerLayout({ fileActive, projectFilesActive });

  return (
    <div
      ref={containerRef}
      data-testid="workspace-shared-explorer-layout"
      className="relative flex h-full min-h-0 flex-1 overflow-hidden"
    >
      {explorerOverlay ? (
        <button
          data-testid="workspace-explorer-scrim"
          type="button"
          aria-label={t('chatWorkspaceHideProjectFiles')}
          className="absolute inset-0 z-10 bg-black/15"
          onClick={() => setExplorerOpen(false)}
        />
      ) : null}
      <div
        data-testid="workspace-shared-explorer"
        data-mode={projectFilesActive ? 'full' : explorerOverlay ? 'overlay' : 'side'}
        className={cn(
          'relative min-h-0 shrink-0 flex-col border-r border-gray-200/80 bg-white',
          showExplorer ? 'flex' : 'hidden',
          projectFilesActive ? 'flex-1 border-r-0' : null,
          explorerOverlay ? 'absolute inset-y-0 left-0 z-20 w-[min(320px,86%)] shadow-xl' : null,
        )}
        style={!projectFilesActive && !explorerOverlay ? { width: explorerWidth } : undefined}
        aria-hidden={!showExplorer}
      >
        <WorkspaceProjectFiles
          activePath={fileActive ? activeSelection.file.path : null}
          onFileOpen={(action) => {
            if (compact) setExplorerOpen(false);
            presenter.chatThreadManager.openFilePreview(action);
          }}
          projectRoot={sessionProjectRoot}
          sessionKey={sessionKey}
          workingDir={sessionWorkingDir}
        />
        {fileActive && !compact ? (
          <div
            data-testid="workspace-explorer-resize-handle"
            aria-label={t('chatWorkspaceResizeProjectFiles')}
            aria-orientation="vertical"
            aria-valuemax={CHAT_WORKSPACE_EXPLORER_MAX_WIDTH}
            aria-valuemin={CHAT_WORKSPACE_EXPLORER_MIN_WIDTH}
            aria-valuenow={explorerWidth}
            role="separator"
            className="absolute inset-y-0 right-[-4px] z-20 w-2 cursor-ew-resize hover:bg-primary/10"
            onPointerDown={onResizeStart}
          />
        ) : null}
      </div>
      {projectFilesActive ? null : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <WorkspaceSelectedContent
            {...selectedContentProps}
            activeSelection={activeSelection}
            explorerControl={
              fileActive
                ? {
                    open: explorerOpen,
                    onToggle: () => setExplorerOpen(!explorerOpen),
                  }
                : undefined
            }
            sessionKey={sessionKey}
            sessionProjectRoot={sessionProjectRoot}
            sessionWorkingDir={sessionWorkingDir}
          />
        </div>
      )}
    </div>
  );
}

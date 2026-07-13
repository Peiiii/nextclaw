import type { ReactNode } from "react";
import {
  AlarmClock,
  ChevronRight,
  FolderTree,
  GitBranch,
  MessageSquarePlus,
} from "lucide-react";
import type { CronJobView } from "@/shared/lib/api";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { SessionConversationArea } from "@/features/chat/features/conversation/components/session-conversation-area";
import { ChatSessionWorkspaceFilePreview } from "@/features/chat/features/workspace/components/chat-session-workspace-file-preview";
import { ChatSessionWorkspaceDirectoryBrowser } from "@/features/chat/features/workspace/components/chat-session-workspace-directory-browser";
import { SessionCronJobContent } from "@/features/chat/features/workspace/components/session-cron-job-content";
import type { ResolvedChildSessionTab } from "@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view";
import type { WorkspaceSelection } from "@/features/chat/features/workspace/utils/chat-workspace-panel-view-model.utils";
import { useServerPathBrowse } from "@/shared/hooks/use-server-path-browse";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type ChatSessionWorkspacePanelContentProps = {
  activeSelection: WorkspaceSelection;
  childSessionTabs: readonly ResolvedChildSessionTab[];
  filePreviewRefreshVersion: number;
  sessionKey: string | null;
  sessionCronJobs: readonly CronJobView[];
  sessionProjectRoot: string | null;
  sessionWorkingDir: string | null;
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
          {typeof count === "number" ? (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-500">
              {count}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-gray-500">
          {description}
        </span>
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

  return (
    <div className="h-full overflow-auto bg-gray-50/45 px-4 py-5 custom-scrollbar">
      <div className="mx-auto max-w-xl">
        <h2 className="text-base font-semibold text-gray-900">
          {t("chatWorkspaceOverview")}
        </h2>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          {t("chatWorkspaceOverviewDescription")}
        </p>
        <div className="mt-4 space-y-2">
          <WorkspaceOverviewEntry
            count={childSessionTabs.length}
            description={t("chatWorkspaceChildSessionsDescription")}
            icon={<GitBranch className="h-4 w-4" />}
            title={t("chatWorkspaceChildSessions")}
            onClick={() => {
              if (sessionKey) {
                presenter.chatThreadManager.openChildSessions(sessionKey);
              }
            }}
          />
          <WorkspaceOverviewEntry
            count={sessionCronJobs.length}
            description={t("chatWorkspaceSessionCronJobsDescription")}
            icon={<AlarmClock className="h-4 w-4" />}
            title={t("chatWorkspaceSessionCronJobs")}
            onClick={() => {
              if (sessionKey) {
                presenter.chatThreadManager.openSessionCronPanel(sessionKey);
              }
            }}
          />
          <WorkspaceOverviewEntry
            description={t("chatWorkspaceProjectFilesDescription")}
            icon={<FolderTree className="h-4 w-4" />}
            title={t("chatWorkspaceProjectFiles")}
            onClick={() => {
              if (sessionKey) {
                presenter.chatThreadManager.openProjectFiles(sessionKey);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function WorkspaceChildSessions({
  childSessionTabs,
}: {
  childSessionTabs: readonly ResolvedChildSessionTab[];
}) {
  const presenter = usePresenter();

  return (
    <div className="h-full overflow-auto bg-gray-50/45 px-4 py-5 custom-scrollbar">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">
            {t("chatWorkspaceChildSessions")}
          </h2>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-500">
            {childSessionTabs.length}
          </span>
        </div>
        {childSessionTabs.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            {t("chatWorkspaceChildSessionsEmpty")}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {childSessionTabs.map((tab) => (
              <button
                key={tab.sessionKey}
                type="button"
                className="group flex w-full items-center gap-3 rounded-lg border border-gray-200/80 bg-white px-3 py-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                onClick={() =>
                  presenter.chatThreadManager.selectChildSessionDetail(
                    tab.sessionKey,
                  )
                }
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                  <GitBranch className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {tab.title}
                  </span>
                  {tab.projectName || tab.sessionTypeLabel ? (
                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      {[tab.sessionTypeLabel, tab.projectName]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkspaceProjectFiles({
  projectRoot,
  workingDir,
}: {
  projectRoot: string | null;
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
        {t("chatWorkspaceProjectFilesUnavailable")}
      </div>
    );
  }

  return (
    <ChatSessionWorkspaceDirectoryBrowser
      browseQuery={browseQuery}
      onFileOpen={presenter.chatThreadManager.openFilePreview}
      renderStatus={({ text, tone = "muted" }) => (
        <div
          className={cn(
            "flex h-full items-center justify-center px-6 text-center text-sm",
            tone === "error" ? "text-rose-600" : "text-gray-500",
          )}
        >
          {text}
        </div>
      )}
      showRoot
    />
  );
}

function ChildSessionMetaChip({ value }: { value: string }) {
  return (
    <span className="inline-flex max-w-full shrink-0 items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
      <span className="truncate">{value}</span>
    </span>
  );
}

function ChildSessionMetaStrip({ tab }: { tab: ResolvedChildSessionTab }) {
  const metaItems = [
    tab.sessionTypeLabel,
    tab.preferredModel,
    tab.projectName,
  ].filter((value): value is string => Boolean(value?.trim()));

  if (metaItems.length === 0 && !tab.projectRoot) {
    return null;
  }

  return (
    <div className="flex min-h-9 min-w-0 items-center gap-1.5 border-b border-gray-200/70 px-3 py-1.5 text-[11px] text-gray-500">
      {metaItems.map((item) => (
        <ChildSessionMetaChip key={item} value={item} />
      ))}
      {tab.projectRoot ? (
        <span
          title={tab.projectRoot}
          className="min-w-0 flex-1 truncate rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500"
        >
          {tab.projectRoot}
        </span>
      ) : null}
    </div>
  );
}

function WorkspaceSideChatDraftHeader() {
  return (
    <div className="border-b border-gray-200/70 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-900">
        <MessageSquarePlus className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">{t("chatWorkspaceSideChatDraftTitle")}</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-gray-500">
        {t("chatWorkspaceSideChatDraftSubtitle")}
      </p>
    </div>
  );
}

export function ChatSessionWorkspacePanelContent({
  activeSelection,
  childSessionTabs,
  filePreviewRefreshVersion,
  sessionKey,
  sessionCronJobs,
  sessionProjectRoot,
  sessionWorkingDir,
}: ChatSessionWorkspacePanelContentProps) {
  const presenter = usePresenter();

  if (activeSelection.kind === "overview") {
    return (
      <WorkspaceOverview
        childSessionTabs={childSessionTabs}
        sessionCronJobs={sessionCronJobs}
        sessionKey={sessionKey}
      />
    );
  }

  if (activeSelection.kind === "project-files") {
    return (
      <WorkspaceProjectFiles
        projectRoot={sessionProjectRoot}
        workingDir={sessionWorkingDir}
      />
    );
  }

  if (activeSelection.kind === "child-sessions") {
    return <WorkspaceChildSessions childSessionTabs={childSessionTabs} />;
  }

  if (activeSelection.kind === "side-chat-draft") {
    return (
      <>
        <WorkspaceSideChatDraftHeader />
        <div className="flex min-h-0 flex-1 flex-col">
          <SessionConversationArea
            materializationContext={{
              kind: "child",
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

  if (activeSelection.kind === "child-session") {
    return (
      <>
        <ChildSessionMetaStrip tab={activeSelection.tab} />
        <div className="flex min-h-0 flex-1 flex-col">
          <SessionConversationArea sessionKey={activeSelection.tab.sessionKey} />
        </div>
      </>
    );
  }

  if (activeSelection.kind === "file") {
    return (
      <ChatSessionWorkspaceFilePreview
        file={activeSelection.file}
        refreshVersion={filePreviewRefreshVersion}
        sessionProjectRoot={sessionProjectRoot}
        sessionWorkingDir={sessionWorkingDir}
        onFileOpen={presenter.chatThreadManager.openFilePreview}
      />
    );
  }

  return <SessionCronJobContent jobs={sessionCronJobs} />;
}

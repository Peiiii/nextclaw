import { MessageSquarePlus } from "lucide-react";
import type { CronJobView } from "@/shared/lib/api";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { SessionConversationArea } from "@/features/chat/features/conversation/components/session-conversation-area";
import { ChatSessionWorkspaceFilePreview } from "@/features/chat/features/workspace/components/chat-session-workspace-file-preview";
import { SessionCronJobContent } from "@/features/chat/features/workspace/components/session-cron-job-content";
import type { ResolvedChildSessionTab } from "@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view";
import type { WorkspaceSelection } from "@/features/chat/features/workspace/utils/chat-workspace-panel-view-model.utils";
import { t } from "@/shared/lib/i18n";

type ChatSessionWorkspacePanelContentProps = {
  activeSelection: WorkspaceSelection;
  filePreviewRefreshVersion: number;
  sessionCronJobs: readonly CronJobView[];
  sessionProjectRoot: string | null;
  sessionWorkingDir: string | null;
};

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
  filePreviewRefreshVersion,
  sessionCronJobs,
  sessionProjectRoot,
  sessionWorkingDir,
}: ChatSessionWorkspacePanelContentProps) {
  const presenter = usePresenter();

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

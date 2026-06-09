import { useRef } from "react";
import { useStickyBottomScroll } from "@nextclaw/agent-chat-ui";
import { FolderGit2, Loader2 } from "lucide-react";
import type { CronJobView } from "@/shared/lib/api";
import { ChatMessageListContainer } from "@/features/chat/features/message/components/chat-message-list.container";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { ChatSessionWorkspaceFilePreview } from "@/features/chat/features/workspace/components/chat-session-workspace-file-preview";
import { SessionCronJobContent } from "@/features/chat/features/workspace/components/session-cron-job-content";
import type { ResolvedChildSessionTab } from "@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view";
import { useNcpSessionConversation } from "@/features/chat/features/ncp/hooks/use-ncp-session-conversation";
import type { WorkspaceSelection } from "@/features/chat/features/workspace/utils/chat-workspace-panel-view-model.utils";
import { AgentIdentityAvatar } from "@/shared/components/common/agent-identity";
import { t } from "@/shared/lib/i18n";

type ChatSessionWorkspacePanelContentProps = {
  activeSelection: WorkspaceSelection;
  sessionCronJobs: readonly CronJobView[];
  sessionProjectRoot: string | null;
  sessionWorkingDir: string | null;
};

function ChildSessionContent({ sessionKey }: { sessionKey: string }) {
  const agent = useNcpSessionConversation(sessionKey);
  const messages = agent.visibleMessages;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onScroll } = useStickyBottomScroll({
    scrollRef,
    resetKey: sessionKey,
    isLoading: agent.isHydrating,
    hasContent: messages.length > 0,
    contentVersion: messages[messages.length - 1] ?? null,
    stickyThresholdPx: 20,
  });

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="h-full overflow-y-auto custom-scrollbar"
    >
      {agent.isHydrating ? (
        <div className="flex h-full items-center justify-center text-sm text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t("chatChildSessionLoading")}
        </div>
      ) : agent.hydrateError ? (
        <div className="px-4 py-5 text-sm text-rose-600">
          {agent.hydrateError.message}
        </div>
      ) : messages.length === 0 && !agent.isRunning ? (
        <div className="px-4 py-5 text-sm text-gray-500">
          {t("chatChildSessionEmpty")}
        </div>
      ) : (
        <div className="px-4 py-5">
          <ChatMessageListContainer
            messages={messages}
            isSending={agent.isRunning}
          />
        </div>
      )}
    </div>
  );
}

function ChildSessionMetaChip({ value }: { value: string }) {
  return (
    <span className="inline-flex max-w-full items-center rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600">
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
    <div className="mt-3 space-y-2">
      {metaItems.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {metaItems.map((item) => (
            <ChildSessionMetaChip key={item} value={item} />
          ))}
        </div>
      ) : null}
      {tab.projectRoot ? (
        <div
          title={tab.projectRoot}
          className="truncate rounded border border-gray-200 bg-gray-50 px-2 py-1.5 font-mono text-[11px] text-gray-500"
        >
          {tab.projectRoot}
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceActiveChildHeader({ tab }: { tab: ResolvedChildSessionTab }) {
  return (
    <div className="border-b border-gray-200/70 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-900">
        {tab.agentId ? (
          <AgentIdentityAvatar
            agentId={tab.agentId}
            className="h-4 w-4 shrink-0"
          />
        ) : (
          <FolderGit2 className="h-4 w-4 shrink-0 text-gray-400" />
        )}
        <span className="truncate">{tab.title}</span>
      </div>
      <ChildSessionMetaStrip tab={tab} />
    </div>
  );
}

export function ChatSessionWorkspacePanelContent({
  activeSelection,
  sessionCronJobs,
  sessionProjectRoot,
  sessionWorkingDir,
}: ChatSessionWorkspacePanelContentProps) {
  const presenter = usePresenter();

  if (activeSelection.kind === "child-session") {
    return (
      <>
        <WorkspaceActiveChildHeader tab={activeSelection.tab} />
        <div className="flex-1 min-h-0">
          <ChildSessionContent sessionKey={activeSelection.tab.sessionKey} />
        </div>
      </>
    );
  }

  if (activeSelection.kind === "file") {
    return (
      <ChatSessionWorkspaceFilePreview
        file={activeSelection.file}
        sessionProjectRoot={sessionProjectRoot}
        sessionWorkingDir={sessionWorkingDir}
        onFileOpen={presenter.chatThreadManager.openFilePreview}
      />
    );
  }

  return <SessionCronJobContent jobs={sessionCronJobs} />;
}

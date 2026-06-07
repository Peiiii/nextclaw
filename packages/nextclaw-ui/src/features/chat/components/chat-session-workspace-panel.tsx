import { useEffect, useMemo, useRef } from "react";
import { FolderGit2, Loader2 } from "lucide-react";
import type {
  ChatFileOpenActionViewModel,
  ChatToolActionViewModel,
} from "@nextclaw/agent-chat-ui";
import type { CronJobView } from "@/shared/lib/api";
import { useStickyBottomScroll } from "@nextclaw/agent-chat-ui";
import { ChatMessageListContainer } from "@/features/chat/components/conversation/chat-message-list.container";
import {
  useNcpChildSessionTabsView,
  type ResolvedChildSessionTab,
} from "@/features/chat/hooks/use-ncp-child-session-tabs-view";
import { useNcpSessionConversation } from "@/features/chat/hooks/use-ncp-session-conversation";
import {
  shouldShowUnreadSessionIndicator,
  useChatSessionListStore,
} from "@/features/chat/stores/chat-session-list.store";
import type {
  ChatChildSessionTab,
  ChatWorkspaceNavigationEntry,
  ChatWorkspaceFileTab,
} from "@/features/chat/stores/chat-thread.store";
import {
  readWorkspaceFileTitle,
  resolveWorkspaceSelection,
  type WorkspaceTabViewModel,
  WorkspaceTabsBar,
} from "./chat-session-workspace-panel-nav";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { ChatSessionWorkspaceFilePreview } from "./chat-session-workspace-file-preview";
import { AgentIdentityAvatar } from "@/shared/components/common/agent-identity";
import { SessionCronJobContent } from "@/features/chat/components/workspace/session-cron-job-content";
import { ResizableRightPanel } from "@/shared/components/resizable-right-panel/resizable-right-panel";
import { t } from "@/shared/lib/i18n";
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

function ChildSessionContent({
  sessionKey,
  onToolAction,
  onFileOpen,
}: {
  sessionKey: string;
  onToolAction?: (action: ChatToolActionViewModel) => void;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
}) {
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
            onToolAction={onToolAction}
            onFileOpen={onFileOpen}
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

function buildWorkspaceTabsViewModel(params: {
  resolvedChildTabs: ResolvedChildSessionTab[];
  workspaceFileTabs: readonly ChatWorkspaceFileTab[];
  sessionCronJobCount: number;
  activeSelection: ReturnType<typeof resolveWorkspaceSelection>;
  optimisticReadAtBySessionKey: Record<string, string>;
  onSelectSession: (sessionKey: string) => void;
  onSelectFile: (fileKey: string) => void;
  onCloseFile: (fileKey: string) => void;
  onSelectCronJobs: () => void;
}): WorkspaceTabViewModel[] {
  const {
    resolvedChildTabs,
    workspaceFileTabs,
    sessionCronJobCount,
    activeSelection,
    optimisticReadAtBySessionKey,
    onSelectSession,
    onSelectFile,
    onCloseFile,
    onSelectCronJobs,
  } = params;

  const childTabs = resolvedChildTabs.map((tab) => {
    const optimisticReadAt = optimisticReadAtBySessionKey[tab.sessionKey];
    const effectiveReadAt =
      optimisticReadAt && tab.readAt
        ? optimisticReadAt.localeCompare(tab.readAt) > 0
          ? optimisticReadAt
          : tab.readAt
        : (optimisticReadAt ?? tab.readAt);
    return {
      key: `child:${tab.sessionKey}`,
      kind: "child-session" as const,
      title: tab.title,
      tooltip: tab.title,
      agentId: tab.agentId,
      active:
        activeSelection?.kind === "child-session" &&
        activeSelection.tab.sessionKey === tab.sessionKey,
      showUnreadDot: shouldShowUnreadSessionIndicator({
        active:
          activeSelection?.kind === "child-session" &&
          activeSelection.tab.sessionKey === tab.sessionKey,
        lastMessageAt: tab.lastMessageAt,
        readAt: effectiveReadAt,
        runStatus: tab.runStatus,
      }),
      onSelect: () => onSelectSession(tab.sessionKey),
    };
  });

  const fileTabs = workspaceFileTabs.map((file) => ({
    key: `file:${file.key}`,
    kind: "file" as const,
    title: readWorkspaceFileTitle(file),
    tooltip: file.path,
    viewMode: file.viewMode,
    active:
      activeSelection?.kind === "file" && activeSelection.file.key === file.key,
    onSelect: () => onSelectFile(file.key),
    onClose: () => onCloseFile(file.key),
  }));

  const cronTab =
    sessionCronJobCount > 0
      ? [
          {
            key: "cron:session",
            kind: "cron" as const,
            title: t("chatWorkspaceSessionCronJobs"),
            tooltip: t("chatWorkspaceSessionCronJobs"),
            active: activeSelection?.kind === "cron",
            onSelect: onSelectCronJobs,
          },
        ]
      : [];

  return [...childTabs, ...fileTabs, ...cronTab];
}

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
    if (
      activeSelection?.kind !== "child-session" ||
      activeSelection.tab.runStatus === "running"
    ) {
      return;
    }
    const activeTabReadAt = activeSelection.tab.lastMessageAt?.trim() ?? null;
    if (!activeTabReadAt) {
      return;
    }
    presenter.chatSessionListManager.markSessionRead(
      activeSelection.tab.sessionKey,
      activeTabReadAt,
      activeSelection.tab.readAt ?? null,
    );
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
        {activeSelection.kind === "child-session" ? (
          <>
            <WorkspaceActiveChildHeader tab={activeSelection.tab} />
            <div className="flex-1 min-h-0">
              <ChildSessionContent
                sessionKey={activeSelection.tab.sessionKey}
                onToolAction={
                  presenter.chatThreadManager.openSessionFromToolAction
                }
                onFileOpen={presenter.chatThreadManager.openFilePreview}
              />
            </div>
          </>
        ) : activeSelection.kind === "file" ? (
          <ChatSessionWorkspaceFilePreview
            file={activeSelection.file}
            sessionProjectRoot={sessionProjectRoot}
            sessionWorkingDir={sessionWorkingDir}
            onFileOpen={presenter.chatThreadManager.openFilePreview}
          />
        ) : (
          <SessionCronJobContent jobs={sessionCronJobs} />
        )}
      </div>
    </ResizableRightPanel>
  );
}

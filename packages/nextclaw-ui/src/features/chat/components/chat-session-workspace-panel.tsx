import { useEffect, useMemo, useRef } from "react";
import { ArrowLeft, FolderGit2, Loader2, X } from "lucide-react";
import type {
  ChatFileOpenActionViewModel,
  ChatToolActionViewModel,
} from "@nextclaw/agent-chat-ui";
import { useStickyBottomScroll } from "@nextclaw/agent-chat-ui";
import { ChatMessageListContainer } from "@/features/chat/components/conversation/chat-message-list.container";
import {
  useNcpChildSessionTabsView,
  type ResolvedChildSessionTab,
} from "@/features/chat/hooks/runtime/use-ncp-child-session-tabs-view";
import { useNcpSessionConversation } from "@/features/chat/hooks/runtime/use-ncp-session-conversation";
import {
  shouldShowUnreadSessionIndicator,
  useChatSessionListStore,
} from "@/features/chat/stores/chat-session-list.store";
import type {
  ChatChildSessionTab,
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
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type ChatSessionWorkspacePanelProps = {
  childSessionTabs: readonly ChatChildSessionTab[];
  activeChildSessionKey: string | null;
  workspaceFileTabs: readonly ChatWorkspaceFileTab[];
  activeWorkspaceFileKey: string | null;
  sessionProjectRoot: string | null;
  onSelectSession: (sessionKey: string) => void;
  onSelectFile: (fileKey: string) => void;
  onCloseFile: (fileKey: string) => void;
  onClose: () => void;
  onBackToParent: () => void;
  onToolAction?: (action: ChatToolActionViewModel) => void;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
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

function WorkspaceActiveChildHeader({
  tab,
}: {
  tab: ResolvedChildSessionTab;
}) {
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

export function ChatSessionWorkspacePanel({
  childSessionTabs,
  activeChildSessionKey,
  workspaceFileTabs,
  activeWorkspaceFileKey,
  sessionProjectRoot,
  onSelectSession,
  onSelectFile,
  onCloseFile,
  onClose,
  onBackToParent,
  onToolAction,
  onFileOpen,
}: ChatSessionWorkspacePanelProps) {
  const presenter = usePresenter();
  const resolvedChildTabs = useNcpChildSessionTabsView(childSessionTabs);
  const optimisticReadAtBySessionKey = useChatSessionListStore(
    (state) => state.optimisticReadAtBySessionKey,
  );
  const activeSelection = resolveWorkspaceSelection({
    activeChildSessionKey,
    activeWorkspaceFileKey,
    childSessionTabs: resolvedChildTabs,
    workspaceFileTabs,
  });
  const hasParentSession = resolvedChildTabs.some((tab) =>
    Boolean(tab.parentSessionKey),
  );

  useEffect(() => {
    if (activeSelection?.kind !== "child-session") {
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

  const workspaceTabs = useMemo<WorkspaceTabViewModel[]>(() => {
    const childTabs = resolvedChildTabs.map((tab) => {
      const optimisticReadAt = optimisticReadAtBySessionKey[tab.sessionKey];
      const effectiveReadAt =
        optimisticReadAt && tab.readAt
          ? optimisticReadAt.localeCompare(tab.readAt) > 0
            ? optimisticReadAt
            : tab.readAt
          : optimisticReadAt ?? tab.readAt;
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
        activeSelection?.kind === "file" &&
        activeSelection.file.key === file.key,
      onSelect: () => onSelectFile(file.key),
      onClose: () => onCloseFile(file.key),
    }));

    return [...childTabs, ...fileTabs];
  }, [
    activeSelection,
    onCloseFile,
    onSelectFile,
    onSelectSession,
    optimisticReadAtBySessionKey,
    resolvedChildTabs,
    workspaceFileTabs,
  ]);

  if (!activeSelection) {
    return null;
  }

  return (
    <aside className="hidden shrink-0 border-l border-gray-200/70 bg-white/95 backdrop-blur-sm md:flex md:w-[26rem] lg:w-[30rem] xl:w-[34rem]">
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200/70 px-4 py-2.5">
          <button
            type="button"
            onClick={onBackToParent}
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium text-gray-600 transition-colors hover:text-gray-900",
              !hasParentSession && "pointer-events-none opacity-0",
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t("chatBackToParent")}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200/80 p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label={t("chatWorkspaceClosePanel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <WorkspaceTabsBar tabs={workspaceTabs} />

        <div className="flex min-h-0 flex-1 flex-col bg-white">
          {activeSelection.kind === "child-session" ? (
            <>
              <WorkspaceActiveChildHeader tab={activeSelection.tab} />
              <div className="flex-1 min-h-0">
                <ChildSessionContent
                  sessionKey={activeSelection.tab.sessionKey}
                  onToolAction={onToolAction}
                  onFileOpen={onFileOpen}
                />
              </div>
            </>
          ) : (
            <ChatSessionWorkspaceFilePreview
              file={activeSelection.file}
              sessionProjectRoot={sessionProjectRoot}
              onFileOpen={onFileOpen}
            />
          )}
        </div>
      </div>
    </aside>
  );
}

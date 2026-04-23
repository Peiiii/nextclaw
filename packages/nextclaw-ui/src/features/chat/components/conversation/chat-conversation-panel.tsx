import { type ComponentProps, useRef } from "react";
import { useStickyBottomScroll } from "@nextclaw/agent-chat-ui";
import type { ChatFileOpenActionViewModel } from "@nextclaw/agent-chat-ui";
import { ChatInputBarContainer } from "@/features/chat/components/conversation/chat-input-bar.container";
import { ChatMessageListContainer } from "@/features/chat/components/conversation/chat-message-list.container";
import {
  ChatConversationHeader,
  ChatParentSessionBanner,
} from "@/features/chat/components/conversation/chat-conversation-header";
import { ChatWelcome } from "@/features/chat/components/chat-welcome";
import { ChatSessionWorkspacePanel } from "@/features/chat";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { resolveAgentRuntimeSessionType } from "@/features/chat/hooks/use-chat-session-type-state";
import { useChatInputStore } from "@/features/chat/stores/chat-input.store";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

const CHAT_CONVERSATION_SKELETON_BUBBLES = [
  {
    key: "hero",
    alignmentClassName: "justify-start",
    bubbleClassName: "max-w-[78%] h-32 rounded-[30px]",
  },
  {
    key: "follow-up",
    alignmentClassName: "justify-start",
    bubbleClassName: "max-w-[62%] h-24 rounded-[28px]",
  },
  {
    key: "reply",
    alignmentClassName: "justify-end",
    bubbleClassName: "max-w-[70%] h-24 rounded-[28px]",
  },
  {
    key: "detail",
    alignmentClassName: "justify-start",
    bubbleClassName: "max-w-[88%] h-36 rounded-[30px]",
  },
] as const;

function ChatConversationSkeleton() {
  return (
    <section
      data-testid="chat-conversation-skeleton"
      className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gradient-to-b from-gray-50/60 to-white"
    >
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="mx-auto flex min-h-full w-full max-w-[min(1120px,100%)] flex-col px-6 py-5">
          <div className="flex flex-1 flex-col gap-8">
            <div className="space-y-6">
              <Skeleton className="h-6 w-52 rounded-lg bg-gray-200/90" />
              <div className="space-y-5">
                {CHAT_CONVERSATION_SKELETON_BUBBLES.map((bubble) => (
                  <div
                    key={bubble.key}
                    className={cn("flex w-full", bubble.alignmentClassName)}
                  >
                    <Skeleton
                      data-testid="chat-conversation-skeleton-bubble"
                      className={cn(
                        "w-full bg-gray-200/80",
                        bubble.bubbleClassName,
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-auto grid gap-4 pb-2 sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)] sm:items-end">
              <div className="space-y-3">
                <Skeleton className="h-4 w-40 rounded-full bg-gray-200/70" />
                <Skeleton className="h-[112px] w-full rounded-[30px] bg-gray-200/70" />
              </div>
              <div className="hidden justify-end sm:flex">
                <Skeleton className="h-10 w-36 rounded-full bg-gray-200/75" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-200/80 bg-white p-4">
        <div className="mx-auto w-full max-w-[min(1120px,100%)]">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card">
            <div className="px-4 py-2.5">
              <Skeleton className="h-[84px] w-full rounded-[28px] bg-gray-200/80" />
            </div>
            <div className="flex items-center justify-between gap-3 px-3 pb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-20 rounded-full bg-gray-200/75" />
                <Skeleton className="h-8 w-28 rounded-full bg-gray-200/75" />
                <Skeleton className="hidden h-8 w-24 rounded-full bg-gray-200/70 sm:block" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full bg-gray-200/85" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type ChatThreadSnapshot = ReturnType<typeof useChatThreadStore.getState>["snapshot"];
type ChatToolActionHandler = ComponentProps<
  typeof ChatMessageListContainer
>["onToolAction"];
type ChatFileOpenHandler = ComponentProps<
  typeof ChatMessageListContainer
>["onFileOpen"];

type ChatConversationAlertsProps = {
  shouldShowProviderHint: boolean;
  sessionTypeUnavailable: boolean;
  sessionTypeUnavailableMessage: string | null;
  onGoToProviders: () => void;
};
function ChatConversationAlerts({
  shouldShowProviderHint,
  sessionTypeUnavailable,
  sessionTypeUnavailableMessage,
  onGoToProviders,
}: ChatConversationAlertsProps) {
  return (
    <>
      {shouldShowProviderHint ? (
        <div className="px-4 py-2.5 border-b border-amber-200/70 bg-amber-50/70 flex items-center justify-between gap-3 shrink-0 sm:px-5">
          <span className="text-xs text-amber-800">
            {t("chatModelNoOptions")}
          </span>
          <button
            type="button"
            onClick={onGoToProviders}
            className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            {t("chatGoConfigureProvider")}
          </button>
        </div>
      ) : null}
      {sessionTypeUnavailable && sessionTypeUnavailableMessage?.trim() ? (
        <div className="px-4 py-2.5 border-b border-amber-200/70 bg-amber-50/70 shrink-0 sm:px-5">
          <span className="text-xs text-amber-800">
            {sessionTypeUnavailableMessage}
          </span>
        </div>
      ) : null}
    </>
  );
}

type ChatConversationContentProps = {
  snapshot: ChatThreadSnapshot;
  availableAgents: NonNullable<ChatThreadSnapshot["availableAgents"]>;
  hideEmptyHint: boolean;
  showWelcome: boolean;
  threadRef: ComponentProps<"div">["ref"];
  onScroll: ComponentProps<"div">["onScroll"];
  onCreateSession: () => void;
  onSelectAgent: (agentId: string) => void;
  onToolAction: ChatToolActionHandler;
  onFileOpen: ChatFileOpenHandler;
};
function ChatConversationContent({
  snapshot,
  availableAgents,
  hideEmptyHint,
  showWelcome,
  threadRef,
  onScroll,
  onCreateSession,
  onSelectAgent,
  onToolAction,
  onFileOpen,
}: ChatConversationContentProps) {
  return (
    <div
      ref={threadRef}
      onScroll={onScroll}
      className="flex-1 min-h-0 overflow-y-auto custom-scrollbar"
    >
      {showWelcome ? (
        <ChatWelcome
          onCreateSession={onCreateSession}
          agents={availableAgents}
          selectedAgentId={snapshot.agentId ?? "main"}
          onSelectAgent={onSelectAgent}
        />
      ) : hideEmptyHint ? null : snapshot.messages.length === 0 ? (
        <div className="px-4 py-4 text-sm text-gray-500 sm:px-5 sm:py-5">
          {t("chatNoMessages")}
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[min(1120px,100%)] px-4 py-4 sm:px-6 sm:py-5">
          <ChatMessageListContainer
            key={snapshot.sessionKey ?? "draft"}
            messages={snapshot.messages}
            isSending={snapshot.isSending && snapshot.isAwaitingAssistantOutput}
            onToolAction={onToolAction}
            onFileOpen={onFileOpen}
          />
        </div>
      )}
    </div>
  );
}

function shouldShowWorkspacePanel(
  snapshot: ChatThreadSnapshot,
  childSessionTabs: ChatThreadSnapshot["childSessionTabs"],
  workspaceFileTabs: ChatThreadSnapshot["workspaceFileTabs"],
) {
  if (snapshot.workspacePanelParentKey !== snapshot.sessionKey) {
    return false;
  }
  return childSessionTabs.length > 0 || workspaceFileTabs.length > 0;
}

export function ChatConversationPanel({
  layoutMode = "desktop",
  onBackToList,
}: {
  layoutMode?: "desktop" | "mobile";
  onBackToList?: () => void;
}) {
  const presenter = usePresenter();
  const defaultSessionType = useChatInputStore(
    (state) => state.snapshot.defaultSessionType,
  );
  const snapshot = useChatThreadStore((state) => state.snapshot);
  const fallbackThreadRef = useRef<HTMLDivElement | null>(null);
  const threadRef = snapshot.threadRef ?? fallbackThreadRef;
  const childSessionTabs = snapshot.childSessionTabs.filter(
    (tab) => tab.parentSessionKey === snapshot.sessionKey,
  );
  const workspaceFileTabs = snapshot.workspaceFileTabs.filter(
    (tab) => tab.parentSessionKey === snapshot.sessionKey,
  );
  const showWorkspacePanel = shouldShowWorkspacePanel(
    snapshot,
    childSessionTabs,
    workspaceFileTabs,
  );
  const shouldShowSessionHeader = Boolean(
    snapshot.sessionKey || snapshot.sessionTypeLabel,
  );
  const sessionHeaderTitle =
    snapshot.sessionDisplayName ||
    (snapshot.canDeleteSession && snapshot.sessionKey ? snapshot.sessionKey : null) ||
    t("chatSidebarNewTask");
  const normalizedAgentId = snapshot.agentId?.trim() ?? "";
  const shouldShowHeaderAgentAvatar =
    normalizedAgentId.length > 0 &&
    normalizedAgentId.toLowerCase() !== "main";

  const showWelcome =
    !snapshot.canDeleteSession &&
    snapshot.messages.length === 0 &&
    !snapshot.isSending;
  const hasConfiguredModel = snapshot.modelOptions.length > 0;
  const shouldShowProviderHint =
    snapshot.isProviderStateResolved && !hasConfiguredModel;
  const hideEmptyHint =
    snapshot.isHistoryLoading &&
    snapshot.messages.length === 0 &&
    !snapshot.isSending &&
    !snapshot.isAwaitingAssistantOutput;
  const availableAgents = snapshot.availableAgents ?? [];
  const resolveDraftAgent = (agentId: string) =>
    availableAgents.find((agent) => agent.id === agentId) ?? null;
  const createDraftSessionForAgent = () => {
    const sessionType = resolveAgentRuntimeSessionType(
      resolveDraftAgent(snapshot.agentId ?? "main"),
      defaultSessionType,
    );
    presenter.chatSessionListManager.createSession(sessionType);
  };
  const selectDraftAgent = (agentId: string) => {
    presenter.chatSessionListManager.setSelectedAgentId(agentId);
    presenter.chatInputManager.setPendingSessionType(
      resolveAgentRuntimeSessionType(resolveDraftAgent(agentId), defaultSessionType),
    );
  };
  const openFilePreview = (action: ChatFileOpenActionViewModel) => {
    presenter.chatThreadManager.openFilePreview(action);
  };
  const openChildSessions = () => {
    if (!snapshot.sessionKey) {
      return;
    }
    presenter.chatThreadManager.openChildSessionPanel({
      parentSessionKey: snapshot.sessionKey,
      activeChildSessionKey: childSessionTabs[0]?.sessionKey ?? null,
    });
  };

  const { onScroll: handleScroll } = useStickyBottomScroll({
    scrollRef: threadRef,
    resetKey: snapshot.sessionKey,
    isLoading: snapshot.isHistoryLoading,
    hasContent: snapshot.messages.length > 0,
    contentVersion: snapshot.messages[snapshot.messages.length - 1] ?? null,
  });

  if (!snapshot.isProviderStateResolved) {
    return <ChatConversationSkeleton />;
  }

  return (
    <section className="flex-1 min-h-0 flex overflow-hidden bg-gradient-to-b from-gray-50/60 to-white">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatParentSessionBanner
          parentSessionLabel={
            snapshot.parentSessionKey ? (snapshot.parentSessionLabel ?? null) : null
          }
          onGoToParentSession={presenter.chatThreadManager.goToParentSession}
        />
        <ChatConversationHeader
          snapshot={snapshot}
          childSessionCount={childSessionTabs.length}
          layoutMode={layoutMode}
          normalizedAgentId={normalizedAgentId}
          sessionHeaderTitle={sessionHeaderTitle}
          shouldShowHeaderAgentAvatar={shouldShowHeaderAgentAvatar}
          shouldShowSessionHeader={shouldShowSessionHeader}
          onBackToList={onBackToList}
          onOpenChildSessions={openChildSessions}
          onDeleteSession={presenter.chatThreadManager.deleteSession}
        />
        <ChatConversationAlerts
          shouldShowProviderHint={shouldShowProviderHint}
          sessionTypeUnavailable={snapshot.sessionTypeUnavailable}
          sessionTypeUnavailableMessage={snapshot.sessionTypeUnavailableMessage ?? null}
          onGoToProviders={presenter.chatThreadManager.goToProviders}
        />
        <ChatConversationContent
          snapshot={snapshot}
          availableAgents={availableAgents}
          hideEmptyHint={hideEmptyHint}
          showWelcome={showWelcome}
          threadRef={threadRef}
          onScroll={handleScroll}
          onCreateSession={createDraftSessionForAgent}
          onSelectAgent={selectDraftAgent}
          onToolAction={presenter.chatThreadManager.openSessionFromToolAction}
          onFileOpen={openFilePreview}
        />

        <ChatInputBarContainer />
      </div>

      {showWorkspacePanel ? (
        <ChatSessionWorkspacePanel
          childSessionTabs={childSessionTabs}
          activeChildSessionKey={snapshot.activeChildSessionKey ?? null}
          workspaceFileTabs={workspaceFileTabs}
          activeWorkspaceFileKey={snapshot.activeWorkspaceFileKey ?? null}
          sessionProjectRoot={snapshot.sessionProjectRoot ?? null}
          displayMode={layoutMode === "mobile" ? "overlay" : "docked"}
          onSelectSession={presenter.chatThreadManager.selectChildSessionDetail}
          onSelectFile={presenter.chatThreadManager.selectWorkspaceFile}
          onCloseFile={presenter.chatThreadManager.closeWorkspaceFile}
          onClose={presenter.chatThreadManager.closeWorkspacePanel}
          onBackToParent={presenter.chatThreadManager.goToParentSession}
          onToolAction={presenter.chatThreadManager.openSessionFromToolAction}
          onFileOpen={openFilePreview}
        />
      ) : null}
    </section>
  );
}

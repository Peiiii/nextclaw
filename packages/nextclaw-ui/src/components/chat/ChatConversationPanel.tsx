import { useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useStickyBottomScroll } from "@nextclaw/agent-chat-ui";
import {
  ChatInputBarContainer,
  ChatMessageListContainer,
} from "@/components/chat/nextclaw";
import { ChatChildSessionPanel } from "@/components/chat/chat-child-session-panel";
import { ChatWelcome } from "@/components/chat/ChatWelcome";
import { usePresenter } from "@/components/chat/presenter/chat-presenter-context";
import { ChatSessionHeaderActions } from "@/components/chat/session-header/chat-session-header-actions";
import { ChatSessionProjectBadge } from "@/components/chat/session-header/chat-session-project-badge";
import { useChatThreadStore } from "@/components/chat/stores/chat-thread.store";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function ChatConversationSkeleton() {
  return (
    <section className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gradient-to-b from-gray-50/60 to-white">
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="mx-auto w-full max-w-[min(1120px,100%)] px-6 py-5">
          <div className="space-y-4">
            <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-24 w-[78%] animate-pulse rounded-2xl bg-gray-200/80" />
            <div className="h-20 w-[62%] animate-pulse rounded-2xl bg-gray-200/80" />
            <div className="h-28 w-[84%] animate-pulse rounded-2xl bg-gray-200/80" />
          </div>
        </div>
      </div>
      <div className="border-t border-gray-200/80 bg-white p-4">
        <div className="mx-auto w-full max-w-[min(1120px,100%)]">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-4">
            <div className="h-16 w-full animate-pulse rounded-xl bg-gray-200/80" />
            <div className="mt-3 flex items-center justify-between">
              <div className="h-8 w-36 animate-pulse rounded-lg bg-gray-200/80" />
              <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-200/80" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ChatConversationPanel() {
  const presenter = usePresenter();
  const snapshot = useChatThreadStore((state) => state.snapshot);
  const fallbackThreadRef = useRef<HTMLDivElement | null>(null);
  const threadRef = snapshot.threadRef ?? fallbackThreadRef;
  const detailSessionKey =
    snapshot.childSessionDetailParentSessionKey === snapshot.sessionKey
      ? snapshot.childSessionDetailSessionKey
      : null;
  const shouldShowSessionHeader = Boolean(
    snapshot.sessionKey || snapshot.sessionTypeLabel,
  );
  const sessionHeaderTitle =
    snapshot.sessionDisplayName ||
    (snapshot.canDeleteSession && snapshot.sessionKey ? snapshot.sessionKey : null) ||
    t("chatSidebarNewTask");

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
        {snapshot.parentSessionKey ? (
          <div className="border-b border-gray-200/60 bg-white/75 px-5 py-2 backdrop-blur-sm">
            <button
              type="button"
              onClick={presenter.chatThreadManager.goToParentSession}
              className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>
                Back to parent
                {snapshot.parentSessionLabel?.trim()
                  ? ` · ${snapshot.parentSessionLabel.trim()}`
                  : ""}
              </span>
            </button>
          </div>
        ) : null}

        <div
          className={cn(
            "px-5 border-b border-gray-200/60 bg-white/80 backdrop-blur-sm flex items-center justify-between shrink-0 overflow-hidden transition-all duration-200",
            shouldShowSessionHeader
              ? "py-3 opacity-100"
              : "h-0 py-0 opacity-0 border-b-0",
          )}
        >
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 truncate">
              {sessionHeaderTitle}
            </span>
            {snapshot.sessionTypeLabel ? (
              <span className="shrink-0 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                {snapshot.sessionTypeLabel}
              </span>
            ) : null}
            {snapshot.sessionProjectName ? (
              <ChatSessionProjectBadge
                sessionKey={snapshot.sessionKey ?? "draft"}
                projectName={snapshot.sessionProjectName}
                projectRoot={snapshot.sessionProjectRoot}
                persistToServer={snapshot.canDeleteSession}
              />
            ) : null}
          </div>
          {snapshot.sessionKey ? (
            <ChatSessionHeaderActions
              sessionKey={snapshot.sessionKey}
              canDeleteSession={snapshot.canDeleteSession}
              isDeletePending={snapshot.isDeletePending}
              projectRoot={snapshot.sessionProjectRoot}
              onDeleteSession={presenter.chatThreadManager.deleteSession}
            />
          ) : null}
        </div>

        {shouldShowProviderHint && (
          <div className="px-5 py-2.5 border-b border-amber-200/70 bg-amber-50/70 flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-amber-800">
              {t("chatModelNoOptions")}
            </span>
            <button
              type="button"
              onClick={presenter.chatThreadManager.goToProviders}
              className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
            >
              {t("chatGoConfigureProvider")}
            </button>
          </div>
        )}

        {snapshot.sessionTypeUnavailable &&
          snapshot.sessionTypeUnavailableMessage?.trim() && (
            <div className="px-5 py-2.5 border-b border-amber-200/70 bg-amber-50/70 shrink-0">
              <span className="text-xs text-amber-800">
                {snapshot.sessionTypeUnavailableMessage}
              </span>
            </div>
          )}

        <div
          ref={threadRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar"
        >
          {showWelcome ? (
            <ChatWelcome
              onCreateSession={presenter.chatThreadManager.createSession}
            />
          ) : hideEmptyHint ? (
            <div className="h-full" />
          ) : snapshot.messages.length === 0 ? (
            <div className="px-5 py-5 text-sm text-gray-500">
              {t("chatNoMessages")}
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[min(1120px,100%)] px-6 py-5">
              <ChatMessageListContainer
                key={snapshot.sessionKey ?? "draft"}
                messages={snapshot.messages}
                isSending={
                  snapshot.isSending && snapshot.isAwaitingAssistantOutput
                }
                onToolAction={presenter.chatThreadManager.openSessionFromToolAction}
              />
            </div>
          )}
        </div>

        <ChatInputBarContainer />
      </div>

      {detailSessionKey ? (
        <ChatChildSessionPanel
          sessionKey={detailSessionKey}
          title={snapshot.childSessionDetailLabel}
          onClose={presenter.chatThreadManager.closeChildSessionDetail}
          onBackToParent={presenter.chatThreadManager.goToParentSession}
          onToolAction={presenter.chatThreadManager.openSessionFromToolAction}
        />
      ) : null}
    </section>
  );
}

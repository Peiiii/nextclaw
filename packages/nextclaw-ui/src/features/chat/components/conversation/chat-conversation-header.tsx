import type { ComponentProps } from "react";
import { ArrowLeft } from "lucide-react";
import { AgentAvatar } from "@/shared/components/common/agent-avatar";
import { SessionContextIconNode } from "@/features/chat/components/session/session-context-icon";
import { ChatSessionHeaderActions } from "@/features/chat/components/conversation/session-header/chat-session-header-actions";
import { ChatSessionProjectBadge } from "@/features/chat/components/conversation/session-header/chat-session-project-badge";
import type { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type ChatThreadSnapshot = ReturnType<typeof useChatThreadStore.getState>["snapshot"];
type ChatHeaderDeleteHandler = ComponentProps<
  typeof ChatSessionHeaderActions
>["onDeleteSession"];

export function ChatParentSessionBanner({
  parentSessionLabel,
  onGoToParentSession,
}: {
  parentSessionLabel: string | null;
  onGoToParentSession: () => void;
}) {
  if (!parentSessionLabel) {
    return null;
  }
  const trimmedLabel = parentSessionLabel.trim();
  return (
    <div className="border-b border-gray-200/60 bg-white/75 px-4 py-2 backdrop-blur-sm sm:px-5">
      <button
        type="button"
        onClick={onGoToParentSession}
        className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>
          {t("chatBackToParent")}
          {trimmedLabel ? ` · ${trimmedLabel}` : ""}
        </span>
      </button>
    </div>
  );
}

export function ChatConversationHeader({
  snapshot,
  childSessionCount,
  layoutMode,
  normalizedAgentId,
  sessionHeaderTitle,
  shouldShowHeaderAgentAvatar,
  shouldShowSessionHeader,
  onBackToList,
  onOpenChildSessions,
  onDeleteSession,
}: {
  snapshot: ChatThreadSnapshot;
  childSessionCount: number;
  layoutMode: "desktop" | "mobile";
  normalizedAgentId: string;
  sessionHeaderTitle: string;
  shouldShowHeaderAgentAvatar: boolean;
  shouldShowSessionHeader: boolean;
  onBackToList?: () => void;
  onOpenChildSessions: () => void;
  onDeleteSession: ChatHeaderDeleteHandler;
}) {
  const isMobileLayout = layoutMode === "mobile";

  return (
    <div
      className={cn(
        "border-b border-gray-200/60 bg-white/80 backdrop-blur-sm flex items-center justify-between shrink-0 overflow-hidden transition-all duration-200",
        isMobileLayout ? "px-3 sm:px-3" : "px-4 sm:px-5",
        shouldShowSessionHeader ? "opacity-100" : "h-0 py-0 opacity-0 border-b-0",
        shouldShowSessionHeader && (isMobileLayout ? "pb-2 pt-2" : "py-3"),
      )}
      style={
        isMobileLayout && shouldShowSessionHeader
          ? { paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }
          : undefined
      }
    >
      <div className="min-w-0 flex-1 flex items-center gap-2">
        {isMobileLayout && onBackToList ? (
          <button
            type="button"
            onClick={onBackToList}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label={t("chat")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        {shouldShowHeaderAgentAvatar ? (
          <div className="inline-flex shrink-0 items-center">
            <AgentAvatar
              agentId={normalizedAgentId}
              displayName={snapshot.agentDisplayName}
              avatarUrl={snapshot.agentAvatarUrl}
              className="h-5 w-5"
            />
          </div>
        ) : null}
        <span className="text-sm font-medium text-gray-700 truncate">
          {sessionHeaderTitle}
        </span>
        {snapshot.sessionTypeLabel ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            {snapshot.sessionTypeIcon?.src ? (
              <span className="inline-flex h-[1.125rem] w-[1.125rem] items-center justify-center">
                <SessionContextIconNode
                  icon={{
                    kind: "runtime-image",
                    src: snapshot.sessionTypeIcon.src,
                    alt: snapshot.sessionTypeIcon.alt ?? null,
                    name: snapshot.sessionTypeLabel,
                  }}
                />
              </span>
            ) : null}
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
          childSessionCount={childSessionCount}
          onOpenChildSessions={onOpenChildSessions}
          onDeleteSession={onDeleteSession}
        />
      ) : null}
    </div>
  );
}

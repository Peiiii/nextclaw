import { ChatConversationHeader } from "@/features/chat/components/conversation/chat-conversation-header";
import { ChatSessionHeaderActions } from "@/features/chat/features/session/components/session-header/chat-session-header-actions";
import { ChatSessionProjectBadge } from "@/features/chat/features/session/components/session-header/chat-session-project-badge";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { SessionContextIconNode } from "@/features/chat/features/session/components/session-context-icon";
import { useChatConversationWorkspaceState } from "@/features/chat/features/workspace/hooks/use-chat-conversation-workspace-state";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import { AgentIdentityAvatar } from "@/shared/components/common/agent-identity";
import { t } from "@/shared/lib/i18n";

type ChatConversationHeaderSectionProps = {
  layoutMode: "desktop" | "mobile";
  onBackToList?: () => void;
};

export function ChatConversationHeaderSection({
  layoutMode,
  onBackToList,
}: ChatConversationHeaderSectionProps) {
  const presenter = usePresenter();
  const snapshot = useChatThreadStore((state) => state.snapshot);
  const { childSessionTabs, sessionCronJobs } =
    useChatConversationWorkspaceState(snapshot);
  const shouldShowSessionHeader = Boolean(
    snapshot.sessionKey || snapshot.sessionTypeLabel,
  );
  const sessionHeaderTitle =
    snapshot.sessionDisplayName ||
    (snapshot.canDeleteSession && snapshot.sessionKey
      ? snapshot.sessionKey
      : null) ||
    t("chatSidebarNewTask");
  const normalizedAgentId = snapshot.agentId?.trim() ?? "";
  const shouldShowHeaderAgentAvatar =
    normalizedAgentId.length > 0 && normalizedAgentId.toLowerCase() !== "main";
  const openChildSessions = () => {
    if (!snapshot.sessionKey) {
      return;
    }
    presenter.chatThreadManager.openChildSessionPanel({
      parentSessionKey: snapshot.sessionKey,
      activeChildSessionKey: childSessionTabs[0]?.sessionKey ?? null,
    });
  };
  const openSessionCronJobs = () => {
    if (!snapshot.sessionKey || sessionCronJobs.length === 0) {
      return;
    }
    presenter.chatThreadManager.openSessionCronPanel(snapshot.sessionKey);
  };

  return (
    <ChatConversationHeader
      layoutMode={layoutMode}
      title={sessionHeaderTitle}
      shouldShow={shouldShowSessionHeader}
      onBackToList={onBackToList}
      leading={
        shouldShowHeaderAgentAvatar ? (
          <div className="inline-flex shrink-0 items-center">
            <AgentIdentityAvatar
              agentId={normalizedAgentId}
              className="h-5 w-5"
            />
          </div>
        ) : null
      }
      sessionTypeBadge={
        snapshot.sessionTypeLabel ? (
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
        ) : null
      }
      projectBadge={
        snapshot.sessionProjectName ? (
          <ChatSessionProjectBadge
            sessionKey={snapshot.sessionKey ?? "draft"}
            projectName={snapshot.sessionProjectName}
            projectRoot={snapshot.sessionProjectRoot}
            persistToServer={snapshot.canDeleteSession}
          />
        ) : null
      }
      actions={
        snapshot.sessionKey ? (
          <ChatSessionHeaderActions
            sessionKey={snapshot.sessionKey}
            canDeleteSession={snapshot.canDeleteSession}
            isDeletePending={snapshot.isDeletePending}
            projectRoot={snapshot.sessionProjectRoot}
            childSessionCount={childSessionTabs.length}
            sessionCronJobCount={sessionCronJobs.length}
            onOpenChildSessions={openChildSessions}
            onOpenSessionCronJobs={openSessionCronJobs}
            onDeleteSession={presenter.chatThreadManager.deleteSession}
          />
        ) : null
      }
    />
  );
}

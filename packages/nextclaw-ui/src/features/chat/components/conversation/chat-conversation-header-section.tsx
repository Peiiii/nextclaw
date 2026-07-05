import { useMemo } from "react";
import { ChatConversationHeader } from "@/features/chat/components/conversation/chat-conversation-header";
import { ChatSessionHeaderActions } from "@/features/chat/features/session/components/session-header/chat-session-header-actions";
import { ChatSessionProjectBadge } from "@/features/chat/features/session/components/session-header/chat-session-project-badge";
import { ChatSessionTitleSwitcher } from "@/features/chat/features/session/components/session-header/chat-session-title-switcher";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { SessionContextIconNode } from "@/features/chat/features/session/components/session-context-icon";
import { useChatConversationWorkspaceState } from "@/features/chat/features/workspace/hooks/use-chat-conversation-workspace-state";
import { useNcpChatSelectedSession } from "@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state";
import { sessionDisplayName } from "@/features/chat/features/session/utils/chat-session-display.utils";
import {
  buildSessionTypeOptions,
  DEFAULT_SESSION_TYPE,
  normalizeSessionType,
  resolveSessionTypeLabel,
} from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { AgentIdentityAvatar } from "@/shared/components/common/agent-identity";
import { getSessionProjectName } from "@/shared/lib/session-project";
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
  const sessionKey = useChatSessionListStore(
    (state) => state.snapshot.selectedSessionKey,
  );
  const selectedAgentId = useChatSessionListStore(
    (state) => state.snapshot.selectedAgentId,
  );
  const sessionTypesData = useChatQueryStore(
    (state) => state.snapshot.sessionTypesQuery?.data ?? null,
  );
  const selectedSession = useNcpChatSelectedSession(sessionKey);
  const sessionTypeOptions = useMemo(
    () => buildSessionTypeOptions(sessionTypesData?.options ?? []),
    [sessionTypesData?.options],
  );
  const sessionType = normalizeSessionType(
    selectedSession?.sessionType ?? sessionTypesData?.defaultType ?? DEFAULT_SESSION_TYPE,
  );
  const sessionTypeOption =
    sessionTypeOptions.find((option) => option.value === sessionType) ?? null;
  const sessionTypeLabel =
    sessionTypeOption?.label ?? resolveSessionTypeLabel(sessionType);
  const sessionProjectRoot = selectedSession?.projectRoot ?? null;
  const sessionProjectName =
    selectedSession?.projectName ?? getSessionProjectName(sessionProjectRoot);
  const canDeleteSession = Boolean(selectedSession);
  const { childSessionTabs, sessionCronJobs } =
    useChatConversationWorkspaceState(snapshot, sessionKey);
  const shouldShowSessionHeader = Boolean(sessionKey || sessionTypeLabel);
  const sessionHeaderTitle =
    (selectedSession ? sessionDisplayName(selectedSession) : undefined) ||
    (canDeleteSession && sessionKey
      ? sessionKey
      : null) ||
    t("chatSidebarNewTask");
  const normalizedAgentId =
    selectedSession?.agentId?.trim() ?? selectedAgentId?.trim() ?? "";
  const shouldShowHeaderAgentAvatar =
    normalizedAgentId.length > 0 && normalizedAgentId.toLowerCase() !== "main";
  const openChildSessions = () => {
    if (!sessionKey) {
      return;
    }
    presenter.chatThreadManager.openChildSessionPanel({
      parentSessionKey: sessionKey,
      activeChildSessionKey: childSessionTabs[0]?.sessionKey ?? null,
    });
  };
  const openSessionCronJobs = () => {
    if (!sessionKey || sessionCronJobs.length === 0) {
      return;
    }
    presenter.chatThreadManager.openSessionCronPanel(sessionKey);
  };

  return (
    <ChatConversationHeader
      layoutMode={layoutMode}
      title={sessionHeaderTitle}
      titleContent={
        <ChatSessionTitleSwitcher
          layoutMode={layoutMode}
          selectedSessionKey={sessionKey}
          title={sessionHeaderTitle}
        />
      }
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
        sessionTypeLabel ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {sessionTypeOption?.icon?.src ? (
              <span className="inline-flex h-[1.125rem] w-[1.125rem] items-center justify-center">
                <SessionContextIconNode
                  icon={{
                    kind: "runtime-image",
                    src: sessionTypeOption.icon.src,
                    alt: sessionTypeOption.icon.alt ?? null,
                    name: sessionTypeLabel,
                  }}
                />
              </span>
            ) : null}
            {sessionTypeLabel}
          </span>
        ) : null
      }
      projectBadge={
        sessionProjectName ? (
          <ChatSessionProjectBadge
            sessionKey={sessionKey ?? "draft"}
            projectName={sessionProjectName}
            projectRoot={sessionProjectRoot}
            persistToServer={canDeleteSession}
          />
        ) : null
      }
      actions={
        sessionKey ? (
          <ChatSessionHeaderActions
            sessionKey={sessionKey}
            canDeleteSession={canDeleteSession}
            isDeletePending={snapshot.isDeletePending}
            projectRoot={sessionProjectRoot}
            metadata={selectedSession?.metadata ?? null}
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

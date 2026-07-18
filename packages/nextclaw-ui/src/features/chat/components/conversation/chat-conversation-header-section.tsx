import { useMemo } from "react";
import { SquarePen } from "lucide-react";
import { ChatConversationHeader } from "@/features/chat/components/conversation/chat-conversation-header";
import { ChatSessionHeaderActions } from "@/features/chat/features/session/components/session-header/chat-session-header-actions";
import { ChatSessionProjectBadge } from "@/features/chat/features/session/components/session-header/chat-session-project-badge";
import { ChatSessionTitleSwitcher } from "@/features/chat/features/session/components/session-header/chat-session-title-switcher";
import { useChatNewSessionTypePreference } from "@/features/chat/features/session-type/hooks/use-chat-new-session-type-preference";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { SessionContextIconNode } from "@/features/chat/features/session/components/session-context-icon";
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
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import {
  getSessionProjectName,
  normalizeSessionProjectRootValue,
} from "@/shared/lib/session-project";
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
  const config = useChatQueryStore(
    (state) => state.snapshot.configQuery?.data ?? null,
  );
  const selectedSession = useNcpChatSelectedSession(sessionKey);
  const sessionTypeOptions = useMemo(
    () => buildSessionTypeOptions(sessionTypesData?.options ?? []),
    [sessionTypesData?.options],
  );
  const defaultSessionType = normalizeSessionType(
    sessionTypesData?.defaultType ?? DEFAULT_SESSION_TYPE,
  );
  const newSessionTypePreference = useChatNewSessionTypePreference({
    defaultSessionType,
    sessionTypeOptions,
  });
  const sessionType = normalizeSessionType(
    selectedSession?.sessionType ?? defaultSessionType,
  );
  const sessionTypeOption =
    sessionTypeOptions.find((option) => option.value === sessionType) ?? null;
  const sessionTypeLabel =
    sessionTypeOption?.label ?? resolveSessionTypeLabel(sessionType);
  const shouldShowSessionTypeBadge =
    sessionType !== DEFAULT_SESSION_TYPE && Boolean(sessionTypeLabel);
  const sessionProjectRoot = selectedSession?.projectRoot ?? null;
  const defaultWorkspacePath = normalizeSessionProjectRootValue(
    config?.agents.defaults.workspace,
  );
  const sessionProjectName =
    selectedSession?.projectName ?? getSessionProjectName(sessionProjectRoot);
  const canDeleteSession = Boolean(selectedSession);
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
  const isWorkspaceOpen = Boolean(
    sessionKey &&
      snapshot.workspacePanelParentKey === sessionKey &&
      snapshot.activeWorkspacePanelKind,
  );
  const toggleWorkspace = () => {
    if (!sessionKey) {
      return;
    }
    presenter.chatThreadManager.toggleWorkspacePanel(sessionKey);
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
        shouldShowSessionTypeBadge ? (
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
            defaultWorkspacePath={defaultWorkspacePath}
            persistToServer={canDeleteSession}
          />
        ) : null
      }
      actions={
        sessionKey ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {layoutMode === "mobile" ? (
              <IconActionButton
                icon={<SquarePen className="h-4 w-4" />}
                label={t("chatSidebarNewTask")}
                tooltip={false}
                onClick={() =>
                  presenter.chatSessionListManager.createSession(
                    newSessionTypePreference.selectedSessionType,
                  )
                }
              />
            ) : null}
            <ChatSessionHeaderActions
              sessionKey={sessionKey}
              canDeleteSession={canDeleteSession}
              isDeletePending={snapshot.isDeletePending}
              currentPath={sessionProjectRoot ?? selectedSession?.workingDir ?? null}
              defaultWorkspacePath={defaultWorkspacePath}
              metadata={selectedSession?.metadata ?? null}
              isWorkspaceOpen={isWorkspaceOpen}
              onToggleWorkspace={toggleWorkspace}
              onDeleteSession={presenter.chatThreadManager.deleteSession}
            />
          </div>
        ) : null
      }
    />
  );
}

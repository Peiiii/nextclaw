import { ChatSessionWorkspacePanel } from "@/features/chat/features/workspace/components/chat-session-workspace-panel";
import { useNcpChatSelectedSession } from "@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state";
import { useChatConversationWorkspaceState } from "@/features/chat/features/workspace/hooks/use-chat-conversation-workspace-state";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { normalizeSessionProjectRootValue } from "@/shared/lib/session-project";

type ChatConversationWorkspaceSectionProps = {
  layoutMode: "desktop" | "mobile";
  sessionKey: string | null;
  projectRoot?: string | null;
};

export function ChatConversationWorkspaceSection({
  layoutMode,
  sessionKey,
  projectRoot,
}: ChatConversationWorkspaceSectionProps) {
  const snapshot = useChatThreadStore((state) => state.snapshot);
  const defaultWorkspacePath = useChatQueryStore((state) =>
    normalizeSessionProjectRootValue(
      state.snapshot.configQuery?.data?.agents.defaults.workspace,
    ),
  );
  const selectedSession = useNcpChatSelectedSession(sessionKey);
  const draftProjectRoot = projectRoot ?? (sessionKey
    ? null
    : snapshot.draftProjectRoot ?? defaultWorkspacePath);
  const {
    childSessionTabs,
    activeSideChatDraft,
    workspaceFileTabs,
    sessionCronJobs,
    sessionCronJobsError,
    sessionCronJobsLoading,
    retrySessionCronJobs,
    showWorkspacePanel,
  } = useChatConversationWorkspaceState(snapshot, sessionKey);

  if (!showWorkspacePanel) {
    return null;
  }

  return (
    <ChatSessionWorkspacePanel
      sessionKey={sessionKey}
      childSessionTabs={sessionKey ? childSessionTabs : []}
      activeChildSessionKey={snapshot.activeChildSessionKey ?? null}
      activeSideChatDraft={activeSideChatDraft}
      workspaceFileTabs={workspaceFileTabs}
      activeWorkspaceFileKey={snapshot.activeWorkspaceFileKey ?? null}
      closedWorkspaceTabEntries={snapshot.closedWorkspaceTabEntries}
      workspaceNavigationHistory={snapshot.workspaceNavigationHistory}
      workspaceNavigationHistoryIndex={snapshot.workspaceNavigationHistoryIndex}
      activePanelKind={snapshot.activeWorkspacePanelKind ?? null}
      sessionCronJobs={sessionKey ? sessionCronJobs : []}
      sessionCronJobsError={sessionKey ? sessionCronJobsError : false}
      sessionCronJobsLoading={sessionKey ? sessionCronJobsLoading : false}
      onRetrySessionCronJobs={retrySessionCronJobs}
      sessionProjectRoot={selectedSession?.projectRoot ?? draftProjectRoot}
      sessionWorkingDir={
        selectedSession?.workingDir ??
        selectedSession?.projectRoot ??
        draftProjectRoot
      }
      workspacePanelWidth={snapshot.workspacePanelWidth}
      displayMode={layoutMode === "mobile" ? "overlay" : "docked"}
    />
  );
}

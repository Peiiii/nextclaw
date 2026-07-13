import { ChatSessionWorkspacePanel } from "@/features/chat/features/workspace/components/chat-session-workspace-panel";
import { useNcpChatSelectedSession } from "@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state";
import { useChatConversationWorkspaceState } from "@/features/chat/features/workspace/hooks/use-chat-conversation-workspace-state";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";

type ChatConversationWorkspaceSectionProps = {
  layoutMode: "desktop" | "mobile";
  sessionKey: string | null;
};

export function ChatConversationWorkspaceSection({
  layoutMode,
  sessionKey,
}: ChatConversationWorkspaceSectionProps) {
  const snapshot = useChatThreadStore((state) => state.snapshot);
  const selectedSession = useNcpChatSelectedSession(sessionKey);
  const {
    childSessionTabs,
    activeSideChatDraft,
    workspaceFileTabs,
    sessionCronJobs,
    showWorkspacePanel,
  } = useChatConversationWorkspaceState(snapshot, sessionKey);

  if (!showWorkspacePanel) {
    return null;
  }

  return (
    <ChatSessionWorkspacePanel
      sessionKey={sessionKey}
      childSessionTabs={childSessionTabs}
      activeChildSessionKey={snapshot.activeChildSessionKey ?? null}
      activeSideChatDraft={activeSideChatDraft}
      workspaceFileTabs={workspaceFileTabs}
      activeWorkspaceFileKey={snapshot.activeWorkspaceFileKey ?? null}
      workspaceNavigationHistory={snapshot.workspaceNavigationHistory}
      workspaceNavigationHistoryIndex={snapshot.workspaceNavigationHistoryIndex}
      activePanelKind={snapshot.activeWorkspacePanelKind ?? null}
      sessionCronJobs={sessionCronJobs}
      sessionProjectRoot={selectedSession?.projectRoot ?? null}
      sessionWorkingDir={
        selectedSession?.workingDir ?? selectedSession?.projectRoot ?? null
      }
      workspacePanelWidth={snapshot.workspacePanelWidth}
      displayMode={layoutMode === "mobile" ? "overlay" : "docked"}
    />
  );
}

import { ChatSessionWorkspacePanel } from "@/features/chat/components/chat-session-workspace-panel";
import { useChatConversationWorkspaceState } from "@/features/chat/features/workspace/hooks/use-chat-conversation-workspace-state";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";

type ChatConversationWorkspaceSectionProps = {
  layoutMode: "desktop" | "mobile";
};

export function ChatConversationWorkspaceSection({
  layoutMode,
}: ChatConversationWorkspaceSectionProps) {
  const snapshot = useChatThreadStore((state) => state.snapshot);
  const {
    childSessionTabs,
    workspaceFileTabs,
    sessionCronJobs,
    showWorkspacePanel,
  } = useChatConversationWorkspaceState(snapshot);

  if (!showWorkspacePanel) {
    return null;
  }

  return (
    <ChatSessionWorkspacePanel
      sessionKey={snapshot.sessionKey}
      childSessionTabs={childSessionTabs}
      activeChildSessionKey={snapshot.activeChildSessionKey ?? null}
      workspaceFileTabs={workspaceFileTabs}
      activeWorkspaceFileKey={snapshot.activeWorkspaceFileKey ?? null}
      workspaceNavigationHistory={snapshot.workspaceNavigationHistory}
      workspaceNavigationHistoryIndex={snapshot.workspaceNavigationHistoryIndex}
      activePanelKind={snapshot.activeWorkspacePanelKind ?? null}
      sessionCronJobs={sessionCronJobs}
      sessionProjectRoot={snapshot.sessionProjectRoot ?? null}
      sessionWorkingDir={
        snapshot.sessionWorkingDir ?? snapshot.sessionProjectRoot ?? null
      }
      displayMode={layoutMode === "mobile" ? "overlay" : "docked"}
    />
  );
}

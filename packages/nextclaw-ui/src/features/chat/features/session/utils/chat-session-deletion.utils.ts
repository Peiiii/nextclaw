import type { ChatThreadSnapshot } from "@/features/chat/stores/chat-thread.store";

export function createDeletedChatThreadStatePatch(): Partial<ChatThreadSnapshot> {
  return {
    sessionKey: null,
    sessionTypeLabel: null,
    agentId: null,
    sessionDisplayName: undefined,
    draftProjectRoot: null,
    sessionProjectName: null,
    canDeleteSession: false,
    parentSessionKey: null,
    parentSessionLabel: null,
    workspacePanelParentKey: null,
    activeWorkspacePanelKind: null,
    childSessionTabs: [],
    activeChildSessionKey: null,
    activeSideChatDraft: null,
    workspaceFileTabs: [],
    activeWorkspaceFileKey: null,
    closedWorkspaceTabEntries: [],
    workspaceNavigationHistory: [],
    workspaceNavigationHistoryIndex: 0,
  };
}

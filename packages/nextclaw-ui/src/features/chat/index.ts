export {
  buildSessionPath,
  buildSessionPanelUrl,
  CHAT_SESSION_PANEL_KIND,
  parseSessionKeyFromPanelUrl,
  parseSessionKeyFromRoute,
  CHAT_DRAFT_SESSION_PATH,
} from "./features/session/utils/chat-session-route.utils";
export { ChatConversationPanel } from "./components/conversation/chat-conversation-panel";
export { ChatConversationWorkspaceSection } from "./components/conversation/chat-conversation-workspace-section";
export { ChatSidebar } from "./components/layout/chat-sidebar";
export { ChatPresenterProvider } from "./components/providers/chat-presenter.provider";
export { ChatRuntimeProvider } from "./components/providers/chat-runtime.provider";
export { CHAT_SESSION_PANEL_RENDERERS } from './features/conversation/components/session-conversation-panel-tab';
export { usePresenter } from "./components/providers/chat-presenter.provider";
export { ChatPresenter } from "./presenters/chat.presenter";
export { ChatDraftIntentManager } from "./managers/chat-draft-intent.manager";
export { ChatComposerIntentManager } from "./managers/chat-composer-intent.manager";
export { ChatCompletionNotificationManager } from "./managers/chat-completion-notification.manager";

export { useChatSessionListStore } from "./stores/chat-session-list.store";
export { useChatThreadStore } from "./stores/chat-thread.store";
export { useChatMessageLayoutStore } from "./stores/chat-message-layout.store";
export { useNcpChatSessionTypes } from "./features/session-type/hooks/use-ncp-chat-session-types";
export {
  buildSessionTypeOptions,
  normalizeSessionType,
  resolveAgentRuntimeSessionType,
  resolveSessionTypeLabel,
  type ChatSessionTypeOption,
} from "./features/session-type/utils/chat-session-type.utils";
export { ChatVoiceShortcutControl } from './features/conversation/components/chat-voice-shortcut-control';

export type { ChatThreadManager } from './managers/chat-thread.manager';
export { useFloatingSessionStore } from './stores/floating-session.store';
export { sessionSurfaceManager } from './managers/session-surface.manager';
export { useInfiniteNcpSessions } from './features/ncp/hooks/use-ncp-session-queries';
export { ChatSessionWorkspaceFilePreview } from './features/workspace/components/chat-session-workspace-file-preview';
export { createWorkspaceFileTab, createWorkspaceFileViewerTab } from './features/workspace/utils/chat-workspace-file-tab.utils';
export { WORKSPACE_FILE_PANEL_KIND, resolveFileResourceTarget, createWorkspaceFilePanelTarget, readWorkspaceFilePanelView } from './features/workspace/utils/workspace-file-panel-route.utils';
export { resolveAlternateWorkspaceFileViewer } from './features/workspace/utils/chat-workspace-file-viewer.utils';

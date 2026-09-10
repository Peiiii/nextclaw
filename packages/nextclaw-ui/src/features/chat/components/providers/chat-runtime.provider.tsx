import { useWorkbenchSurfaceStore } from '@/shared/components/workbench/stores/workbench-surface.store';
import { GLOBAL_WORKBENCH_SURFACE, SESSION_WORKBENCH_SURFACE } from '@/shared/components/workbench/types/workbench-surface.types';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useAppPresenter } from '@/app/components/app-presenter-provider';
import { ChatPresenter } from '@/features/chat/presenters/chat.presenter';
import { ChatPresenterProvider, usePresenter } from './chat-presenter.provider';
import { useConfirmDialog } from '@/shared/hooks/use-confirm-dialog';
import { useChatQueryStoreSync } from '@/features/chat/features/ncp/hooks/use-ncp-chat-query-store-sync';
import { parseSessionKeyFromRoute } from '@/features/chat/features/session/utils/chat-session-route.utils';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import { useFloatingSessionStore } from '@/features/chat/stores/floating-session.store';
import { FloatingSessionConversation } from '@/features/chat/features/conversation/components/floating-session-conversation';
import { useDocBrowserStore } from '@/shared/components/doc-browser/stores/doc-browser.store';
import { CHAT_SESSION_PANEL_KIND, parseSessionKeyFromPanelUrl } from '@/features/chat/features/session/utils/chat-session-route.utils';

function ChatRuntime({ children }: { children: ReactNode }) {
  const presenter = usePresenter();
  const appPresenter = useAppPresenter();
  const location = useLocation();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const match = useMatch('/chat/:sessionId');
  const sessionKey = parseSessionKeyFromRoute(match?.params.sessionId);
  const workspaceMinimized = useWorkbenchSurfaceStore((state) => state.surfaces[`session-workspace:${sessionKey ?? 'draft'}`]?.minimized ?? false);
  const workspaceSessionKey = useChatThreadStore(({ snapshot }) =>
    snapshot.workspacePanelParentKey === sessionKey && sessionKey && !snapshot.workspacePanelHidden && !workspaceMinimized &&
    snapshot.activeWorkspacePanelKind === 'child-session'
      ? snapshot.activeChildSessionKey : null,
  );
  const floatingMinimized = useWorkbenchSurfaceStore((state) => state.surfaces[SESSION_WORKBENCH_SURFACE]?.minimized ?? false);
  const panelMinimized = useWorkbenchSurfaceStore((state) => state.surfaces[GLOBAL_WORKBENCH_SURFACE]?.minimized ?? false);
  const floatingSessionKey = useFloatingSessionStore((state) => floatingMinimized ? null : state.session?.sessionKey);
  const panelSessionKey = useDocBrowserStore(({ snapshot }) => {
    const tab = snapshot.tabs.find((item) => item.id === snapshot.activeTabId);
    return snapshot.isOpen && !panelMinimized && tab?.kind === CHAT_SESSION_PANEL_KIND
      ? parseSessionKeyFromPanelUrl(tab.currentUrl) : null;
  });
  useChatQueryStoreSync({ sessionKey });
  useEffect(() => {
    presenter.chatUiManager.syncState({ pathname: location.pathname });
    presenter.chatUiManager.bindActions({ navigate, confirm });
  }, [confirm, location.pathname, navigate, presenter]);
  useEffect(() => {
    appPresenter.chatCompletionNotificationManager.syncVisibleSessions([
      sessionKey, workspaceSessionKey, floatingSessionKey, panelSessionKey,
    ]);
    return () => appPresenter.chatCompletionNotificationManager.syncVisibleSessions([]);
  }, [appPresenter, sessionKey, workspaceSessionKey, floatingSessionKey, panelSessionKey]);

  return <>{children}<FloatingSessionConversation /><ConfirmDialog /></>;
}

export function ChatRuntimeProvider({ children }: { children: ReactNode }) {
  const appPresenter = useAppPresenter();
  const presenter = useMemo(() => new ChatPresenter(appPresenter), [appPresenter]);
  return (
    <ChatPresenterProvider presenter={presenter}>
      <ChatRuntime>{children}</ChatRuntime>
    </ChatPresenterProvider>
  );
}

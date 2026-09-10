import { useFloatingSessionStore, type FloatingSession } from '@/features/chat/stores/floating-session.store';
import type { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';
import type { DocBrowserTab } from '@/shared/components/doc-browser/types/doc-browser.types';
import { useDocBrowserStore } from '@/shared/components/doc-browser/stores/doc-browser.store';
import { buildSessionPanelUrl, CHAT_SESSION_PANEL_KIND, parseSessionKeyFromPanelUrl } from '@/features/chat/features/session/utils/chat-session-route.utils';

class SessionSurfaceManager {
  open = (session: FloatingSession): void => {
    useFloatingSessionStore.setState({ session, minimized: false });
  };

  minimize = (): void => {
    useFloatingSessionStore.setState({ minimized: true });
  };

  restore = (): void => {
    useFloatingSessionStore.setState({ minimized: false });
  };

  close = (): void => {
    useFloatingSessionStore.setState({ session: null, minimized: false });
  };

  dock = (session: FloatingSession, docBrowser: DocBrowserManager): void => {
    if (useDocBrowserStore.getState().snapshot.mode !== 'docked') docBrowser.toggleMode();
    docBrowser.open(buildSessionPanelUrl(session.sessionKey), {
      kind: CHAT_SESSION_PANEL_KIND,
      title: session.title,
      newTab: true,
      dedupeKey: buildSessionPanelUrl(session.sessionKey),
    });
    if (useFloatingSessionStore.getState().session?.sessionKey === session.sessionKey) this.close();
  };

  popOut = (tab: DocBrowserTab, docBrowser: DocBrowserManager): void => {
    const sessionKey = parseSessionKeyFromPanelUrl(tab.currentUrl);
    if (!sessionKey) return;
    this.open({ sessionKey, title: tab.title });
    docBrowser.closeTab(tab.id);
  };
}

export const sessionSurfaceManager = new SessionSurfaceManager();

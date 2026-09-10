import { workbenchSurfaceManager } from '@/shared/components/workbench/managers/workbench-surface.manager';
import { GLOBAL_WORKBENCH_SURFACE, SESSION_WORKBENCH_SURFACE } from '@/shared/components/workbench/types/workbench-surface.types';
import { useFloatingSessionStore, type FloatingSession } from '@/features/chat/stores/floating-session.store';
import type { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';
import type { DocBrowserTab } from '@/shared/components/doc-browser/types/doc-browser.types';
import { buildSessionPanelUrl, CHAT_SESSION_PANEL_KIND, parseSessionKeyFromPanelUrl } from '@/features/chat/features/session/utils/chat-session-route.utils';

class SessionSurfaceManager {
  open = (session: FloatingSession): void => {
    useFloatingSessionStore.setState({ session });
    workbenchSurfaceManager.place(SESSION_WORKBENCH_SURFACE, 'floating');
  };

  minimize = (): void => {
    workbenchSurfaceManager.minimize(SESSION_WORKBENCH_SURFACE);
  };

  restore = (): void => {
    workbenchSurfaceManager.restore(SESSION_WORKBENCH_SURFACE);
  };

  close = (): void => {
    useFloatingSessionStore.setState({ session: null });
    workbenchSurfaceManager.place(SESSION_WORKBENCH_SURFACE, 'floating');
  };

  dock = (session: FloatingSession, docBrowser: DocBrowserManager): void => {
    workbenchSurfaceManager.place(GLOBAL_WORKBENCH_SURFACE, 'docked');
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

import { WorkbenchSurfaceManager } from '@/shared/components/workbench/managers/workbench-surface.manager';
import { beforeEach, expect, it } from 'vitest';
import { sessionSurfaceManager } from '@/features/chat/managers/session-surface.manager';
import { useFloatingSessionStore } from '@/features/chat/stores/floating-session.store';
import { useDocBrowserStore } from '@/shared/components/doc-browser/stores/doc-browser.store';
import { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';
import { createDefaultDocBrowserState } from '@/shared/components/doc-browser/utils/doc-browser-state.utils';
import { RightPanelResourceRouteResolver } from '@/features/right-panel-resources';
import { parseSessionKeyFromPanelUrl } from '@/features/chat/features/session/utils/chat-session-route.utils';

const docBrowser = new DocBrowserManager(new WorkbenchSurfaceManager(), new RightPanelResourceRouteResolver());
const session = { sessionKey: 'session:中文/path', title: 'Review' };

beforeEach(() => {
  sessionSurfaceManager.close();
  useDocBrowserStore.getState().setSnapshot(createDefaultDocBrowserState());
});

it('docks and deduplicates a session without replacing unrelated tabs', () => {
  docBrowser.open('nextclaw://apps', { newTab: true });
  const existingIds = useDocBrowserStore.getState().snapshot.tabs.map(tab => tab.id);
  docBrowser.toggleMode();
  sessionSurfaceManager.open(session);
  sessionSurfaceManager.dock(session, docBrowser);
  const state = useDocBrowserStore.getState().snapshot;
  const tab = state.tabs.find(item => item.id === state.activeTabId)!;
  expect(new WorkbenchSurfaceManager().get('global-resources').placement).toBe('docked');
  expect(state.isOpen).toBe(true);
  expect(tab.kind).toBe('chat-session');
  expect(tab.title).toBe(session.title);
  expect(parseSessionKeyFromPanelUrl(tab.currentUrl)).toBe(session.sessionKey);
  expect(state.tabs.map(item => item.id)).toEqual(expect.arrayContaining(existingIds));
  expect(useFloatingSessionStore.getState().session).toBeNull();
  sessionSurfaceManager.dock(session, docBrowser);
  expect(useDocBrowserStore.getState().snapshot.tabs).toHaveLength(state.tabs.length);
  sessionSurfaceManager.popOut(tab, docBrowser);
  expect(useFloatingSessionStore.getState().session).toEqual(session);
  expect(useDocBrowserStore.getState().snapshot.tabs.map(item => item.id)).toEqual(existingIds);
});

it('keeps an unrelated floating session when docking another session', () => {
  sessionSurfaceManager.open(session);
  sessionSurfaceManager.dock({ sessionKey: 'other', title: 'Other' }, docBrowser);
  expect(useFloatingSessionStore.getState().session).toEqual(session);
});

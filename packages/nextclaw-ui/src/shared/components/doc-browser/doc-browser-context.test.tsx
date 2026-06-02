import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DocBrowserProvider, useDocBrowser } from './doc-browser-context';
import { RightPanelResourceRouteResolver } from '@/features/right-panel-resources';
import { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';
import { createDefaultDocBrowserState } from '@/shared/components/doc-browser/utils/doc-browser-state.utils';
import { useDocBrowserStore } from '@/shared/components/doc-browser/stores/doc-browser.store';

vi.mock('@/shared/lib/i18n', async () => {
  const actual = await vi.importActual('@/shared/lib/i18n');
  return {
    ...(actual as object),
    getLanguage: () => 'en',
  };
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <DocBrowserProvider manager={testDocBrowserManager}>{children}</DocBrowserProvider>
);

const testDocBrowserManager = new DocBrowserManager(new RightPanelResourceRouteResolver());

const docBrowserStorageKey = 'nextclaw.doc-browser.state';

beforeEach(() => {
  act(() => {
    useDocBrowserStore.setState({ snapshot: createDefaultDocBrowserState() });
  });
  window.localStorage.clear();
});

function readPersistedDocBrowserSnapshot() {
  return JSON.parse(window.localStorage.getItem(docBrowserStorageKey) ?? '{}') as {
    state?: {
      snapshot?: Record<string, unknown>;
    };
  };
}

async function rehydrateDocBrowserFromStorage() {
  await act(async () => {
    await useDocBrowserStore.persist.rehydrate();
  });
}

async function resetMemoryThenRehydrate(savedState: string | null) {
  act(() => {
    useDocBrowserStore.setState({ snapshot: createDefaultDocBrowserState() });
  });
  if (savedState) {
    window.localStorage.setItem(docBrowserStorageKey, savedState);
  }
  await rehydrateDocBrowserFromStorage();
}

describe('DocBrowserProvider dedupe keys', () => {
  it('opens different dedupe keys as separate content tabs', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.open('data:text/html,A', {
        dedupeKey: 'marketplace:skill:a',
        kind: 'content',
        title: 'Skill A',
      });
    });
    act(() => {
      result.current.open('data:text/html,B', {
        dedupeKey: 'marketplace:skill:b',
        kind: 'content',
        title: 'Skill B',
      });
    });

    const contentTabs = result.current.tabs.filter((tab) => tab.kind === 'content');
    expect(contentTabs).toHaveLength(2);
    expect(contentTabs.map((tab) => tab.dedupeKey)).toEqual([
      'marketplace:skill:a',
      'marketplace:skill:b',
    ]);
  });

  it('updates the existing tab for the same dedupe key', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.open('data:text/html,Loading', {
        dedupeKey: 'marketplace:skill:a',
        kind: 'content',
        title: 'Loading',
      });
    });
    act(() => {
      result.current.open('data:text/html,Loaded', {
        dedupeKey: 'marketplace:skill:a',
        kind: 'content',
        title: 'Loaded',
      });
    });

    const contentTabs = result.current.tabs.filter((tab) => tab.kind === 'content');
    expect(contentTabs).toHaveLength(1);
    expect(contentTabs[0]).toMatchObject({
      currentUrl: 'data:text/html,Loaded',
      dedupeKey: 'marketplace:skill:a',
      title: 'Loaded',
    });
  });

  it('updates a matched tab without stealing focus when activation is disabled', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.open('data:text/html,A', {
        dedupeKey: 'marketplace:skill:a',
        kind: 'content',
        title: 'Skill A',
      });
      result.current.open('data:text/html,B', {
        dedupeKey: 'marketplace:skill:b',
        kind: 'content',
        title: 'Skill B',
      });
    });
    const { activeTabId } = result.current;

    act(() => {
      result.current.open('data:text/html,A-loaded', {
        activate: false,
        dedupeKey: 'marketplace:skill:a',
        kind: 'content',
        title: 'Skill A',
      });
    });

    expect(result.current.activeTabId).toBe(activeTabId);
    expect(result.current.tabs.find((tab) => tab.dedupeKey === 'marketplace:skill:a')).toMatchObject({
      currentUrl: 'data:text/html,A-loaded',
    });
  });

  it('updates custom URL query state for the same dedupe key', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.open('nextclaw://apps', {
        dedupeKey: 'apps',
        kind: 'apps',
        title: 'Apps',
      });
    });
    act(() => {
      result.current.open('nextclaw://apps?tab=service-apps', {
        activate: false,
        dedupeKey: 'apps',
        kind: 'apps',
        title: 'Apps',
      });
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'nextclaw://apps?tab=service-apps',
      dedupeKey: 'apps',
      kind: 'apps',
    });
  });
});

describe('DocBrowserProvider built-in routes', () => {
  it('opens the built-in start page without falling back to docs', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.openNewTab();
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'nextclaw://new-tab',
      kind: 'home',
      title: 'Start Page',
    });
  });

  it('replaces the closed default start page when opening docs as a new tab', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.open(undefined, {
        kind: 'docs',
        newTab: true,
        title: 'Help Docs',
      });
    });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.currentTab).toMatchObject({
      kind: 'docs',
      title: 'Help Docs',
    });
  });

  it('infers built-in apps routes without component-level options', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.open('nextclaw://apps?tab=service-apps');
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'nextclaw://apps?tab=service-apps',
      dedupeKey: 'apps',
      kind: 'apps',
      title: 'Service Apps',
    });
  });
});

describe('DocBrowserProvider panel app resources', () => {
  it('opens an already resolved panel app target without reparsing its content URL', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.openTarget({
        dedupeKey: 'panel-app:demo',
        dockIcon: { type: 'url', url: '/api/panel-apps/demo/assets/icon.png' },
        historyPolicy: 'managed',
        kind: 'panel-app',
        resourceUri: 'nextclaw://panel-app/demo',
        title: 'Demo Panel App',
        url: '/api/panel-apps/demo/content',
      });
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: '/api/panel-apps/demo/content',
      dedupeKey: 'panel-app:demo',
      dockIcon: { type: 'url', url: '/api/panel-apps/demo/assets/icon.png' },
      kind: 'panel-app',
      resourceUri: 'nextclaw://panel-app/demo',
      title: 'Demo Panel App',
    });
  });
});

describe('DocBrowserProvider managed history', () => {
  it('uses managed history for non-doc routes', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.open('data:text/html,A', {
        kind: 'content',
        title: 'A',
      });
    });
    act(() => {
      result.current.navigate('data:text/html,B');
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'data:text/html,B',
      historyIndex: 1,
      kind: 'content',
    });

    act(() => {
      result.current.goBack();
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'data:text/html,A',
      historyIndex: 0,
      kind: 'content',
    });
  });

  it('stops back and forward navigation at browser history boundaries', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.open('data:text/html,A', {
        kind: 'content',
        title: 'A',
      });
      result.current.navigate('data:text/html,B');
    });

    act(() => {
      result.current.goBack();
      result.current.goBack();
      result.current.goBack();
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'data:text/html,A',
      kind: 'content',
    });
    expect(result.current.activeHistoryIndex).toBe(0);

    act(() => {
      result.current.goForward();
      result.current.goForward();
      result.current.goForward();
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'data:text/html,B',
      historyIndex: 1,
      history: ['data:text/html,A', 'data:text/html,B'],
    });
    expect(result.current.activeHistoryIndex).toBe(1);
  });

  it('records active tab switching in the top-level browser history', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.open('data:text/html,A', {
        kind: 'content',
        title: 'A',
      });
      result.current.openNewTab();
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'nextclaw://new-tab',
      kind: 'home',
    });

    act(() => {
      result.current.goBack();
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'data:text/html,A',
      kind: 'content',
    });

    act(() => {
      result.current.goForward();
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'nextclaw://new-tab',
      kind: 'home',
    });
  });

  it('restores panel app history by stable resource URI instead of reparsing content URL as an app id', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.openTarget({
        dedupeKey: 'panel-app:demo',
        historyPolicy: 'managed',
        kind: 'panel-app',
        resourceUri: 'nextclaw://panel-app/demo',
        title: 'Demo Panel App',
        url: '/api/panel-apps/demo/content',
      });
      result.current.openNewTab();
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'nextclaw://new-tab',
      kind: 'home',
    });

    act(() => {
      result.current.goBack();
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: '/api/panel-apps/demo/content',
      dedupeKey: 'panel-app:demo',
      kind: 'panel-app',
      resourceUri: 'nextclaw://panel-app/demo',
      title: 'Demo Panel App',
    });
    expect(result.current.currentTab?.currentUrl).not.toBe('/api/panel-apps/api/content');
    expect(result.current.activeHistory[result.current.activeHistoryIndex]).toMatchObject({
      resourceUri: 'nextclaw://panel-app/demo',
      url: '/api/panel-apps/demo/content',
    });
  });

  it('truncates forward history before appending manual navigation after going back', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.open('data:text/html,A', {
        kind: 'content',
        title: 'A',
      });
      result.current.navigate('data:text/html,B');
      result.current.navigate('data:text/html,C');
      result.current.goBack();
      result.current.navigate('data:text/html,D');
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'data:text/html,D',
      historyIndex: 2,
      history: ['data:text/html,A', 'data:text/html,B', 'data:text/html,D'],
    });
  });

  it('deduplicates consecutive manual navigation to the current URL', () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.open('data:text/html,A', {
        kind: 'content',
        title: 'A',
      });
      result.current.navigate('data:text/html,B');
      result.current.navigate('data:text/html,B');
    });

    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'data:text/html,B',
      historyIndex: 1,
      history: ['data:text/html,A', 'data:text/html,B'],
    });
  });
});

describe('DocBrowserProvider persistence', () => {
  it('persists dock icon metadata for restored tabs', async () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.openTarget({
        dedupeKey: 'panel-app:demo',
        dockIcon: { type: 'text', value: 'D' },
        historyPolicy: 'managed',
        kind: 'panel-app',
        resourceUri: 'nextclaw://panel-app/demo',
        title: 'Demo App',
        url: '/api/panel-apps/demo/content',
      });
    });

    const savedState = window.localStorage.getItem(docBrowserStorageKey);
    await resetMemoryThenRehydrate(savedState);
    const restored = renderHook(() => useDocBrowser(), { wrapper });

    expect(restored.result.current.currentTab).toMatchObject({
      dockIcon: { type: 'text', value: 'D' },
      resourceUri: 'nextclaw://panel-app/demo',
    });
  });

  it('restores the open panel and active tab from the persisted Zustand store', async () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.open('nextclaw://apps?tab=service-apps', {
        dedupeKey: 'apps',
        kind: 'apps',
        title: 'Apps',
      });
    });

    await waitFor(() => {
      expect(readPersistedDocBrowserSnapshot()).toMatchObject({
        state: {
          snapshot: {
            isOpen: true,
            activeTabId: result.current.activeTabId,
          },
        },
      });
    });

    const savedState = window.localStorage.getItem(docBrowserStorageKey);
    await resetMemoryThenRehydrate(savedState);
    const restored = renderHook(() => useDocBrowser(), { wrapper });

    expect(restored.result.current.isOpen).toBe(true);
    expect(restored.result.current.currentTab).toMatchObject({
      kind: 'apps',
      currentUrl: 'nextclaw://apps?tab=service-apps',
      dedupeKey: 'apps',
    });
  });

  it('keeps the panel closed after a closed state is persisted', async () => {
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    act(() => {
      result.current.open('nextclaw://apps', {
        dedupeKey: 'apps',
        kind: 'apps',
        title: 'Apps',
      });
      result.current.close();
    });

    await waitFor(() => {
      expect(readPersistedDocBrowserSnapshot()).toMatchObject({
        state: {
          snapshot: {
            isOpen: false,
          },
        },
      });
    });

    const savedState = window.localStorage.getItem(docBrowserStorageKey);
    await resetMemoryThenRehydrate(savedState);
    const restored = renderHook(() => useDocBrowser(), { wrapper });

    expect(restored.result.current.isOpen).toBe(false);
    expect(restored.result.current.currentTab).toMatchObject({
      kind: 'apps',
      currentUrl: 'nextclaw://apps',
    });
  });

  it('falls back to the start page when persisted state is malformed', async () => {
    window.localStorage.setItem(docBrowserStorageKey, JSON.stringify({
      version: 1,
      state: {
        snapshot: {
          isOpen: true,
          tabs: [{ id: 'broken' }],
          activeTabId: 'broken',
        },
      },
    }));

    await rehydrateDocBrowserFromStorage();
    const { result } = renderHook(() => useDocBrowser(), { wrapper });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.currentTab).toMatchObject({
      currentUrl: 'nextclaw://new-tab',
      kind: 'home',
    });
  });
});

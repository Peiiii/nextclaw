import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DocBrowserProvider, useDocBrowser } from './doc-browser-context';
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
  <DocBrowserProvider>{children}</DocBrowserProvider>
);

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

describe('DocBrowserProvider persistence', () => {
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

  it('falls back to the default docs tab when persisted state is malformed', async () => {
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
    expect(result.current.currentTab?.kind).toBe('docs');
  });
});

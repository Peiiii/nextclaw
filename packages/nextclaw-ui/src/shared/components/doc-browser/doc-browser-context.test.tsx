import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DocBrowserProvider, useDocBrowser } from './doc-browser-context';

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
    const activeTabId = result.current.activeTabId;

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
});

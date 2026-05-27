import type {
  DocBrowserOpenOptions,
  DocBrowserState,
  DocBrowserStateUpdate,
  DocBrowserTab,
  DocBrowserTabKind,
} from '@/shared/components/doc-browser/types/doc-browser.types';
import {
  createDefaultDocBrowserState,
  createDocBrowserTab,
} from '@/shared/components/doc-browser/utils/doc-browser-state.utils';
import {
  getDefaultDocsUrl,
  inferTabKind,
  normalizeDocUrl,
  normalizeUrlByKind,
} from '@/shared/components/doc-browser/utils/doc-browser-url.utils';
import { useDocBrowserStore } from '@/shared/components/doc-browser/stores/doc-browser.store';

function updateTab(
  state: DocBrowserState,
  tabId: string,
  updater: (tab: DocBrowserTab) => DocBrowserTab,
): DocBrowserState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab)),
  };
}

function updateActiveTab(state: DocBrowserState, updater: (tab: DocBrowserTab) => DocBrowserTab): DocBrowserState {
  return updateTab(state, state.activeTabId, updater);
}

function areOpenUrlsEquivalent(
  currentUrl: string,
  nextUrl: string,
  currentKind: DocBrowserTabKind,
  nextKind: DocBrowserTabKind,
): boolean {
  if (currentKind === 'docs' && nextKind === 'docs') {
    return normalizeDocUrl(currentUrl) === normalizeDocUrl(nextUrl);
  }
  return currentUrl === nextUrl;
}

function updateTabForOpen(
  tab: DocBrowserTab,
  url: string,
  kind: DocBrowserTabKind,
  options?: DocBrowserOpenOptions,
  dedupeKey?: string,
): DocBrowserTab {
  const baseTab = {
    ...tab,
    title: options?.title || tab.title,
    kind,
    dedupeKey,
  };

  if (areOpenUrlsEquivalent(tab.currentUrl, url, tab.kind, kind)) {
    return baseTab;
  }

  return {
    ...baseTab,
    currentUrl: url,
    history: [...tab.history.slice(0, tab.historyIndex + 1), url],
    historyIndex: tab.historyIndex + 1,
    navVersion: tab.navVersion + 1,
  };
}

function resolveOpenTargetUrl(params: {
  url?: string;
  kind: DocBrowserTabKind;
  activeTab?: DocBrowserTab;
}): string {
  const { activeTab, kind, url } = params;
  if (url && url.trim().length > 0) {
    return normalizeUrlByKind(url, kind);
  }

  if (kind === 'docs') {
    return getDefaultDocsUrl();
  }
  return activeTab?.currentUrl ?? getDefaultDocsUrl();
}

function openDocBrowserState(
  prev: DocBrowserState,
  url?: string,
  options?: DocBrowserOpenOptions,
): DocBrowserState {
  const {
    activate,
    dedupeKey: rawDedupeKey,
    kind,
    newTab: shouldForceNewTab,
    title,
  } = options ?? {};
  const activeTab = prev.tabs.find((tab) => tab.id === prev.activeTabId) ?? prev.tabs[0];
  const targetKind = kind ?? (url ? inferTabKind(url) : activeTab?.kind ?? 'docs');
  const targetUrl = resolveOpenTargetUrl({ url, kind: targetKind, activeTab });
  const dedupeKey = rawDedupeKey?.trim() || undefined;
  const matchedTab = dedupeKey
    ? prev.tabs.find((tab) => tab.dedupeKey === dedupeKey)
    : undefined;

  if (matchedTab) {
    const next = updateTab(
      prev,
      matchedTab.id,
      (tab) => updateTabForOpen(tab, targetUrl, targetKind, options, dedupeKey),
    );
    return {
      ...next,
      activeTabId: activate === false ? prev.activeTabId : matchedTab.id,
      isOpen: true,
    };
  }

  if (shouldForceNewTab || dedupeKey || !activeTab || activeTab.kind !== targetKind) {
    const newTab = createDocBrowserTab(targetUrl, targetKind, title, dedupeKey);
    return {
      ...prev,
      isOpen: true,
      tabs: [...prev.tabs, newTab],
      activeTabId: newTab.id,
    };
  }

  const next = updateActiveTab(
    prev,
    (tab) => updateTabForOpen(tab, targetUrl, targetKind, options, dedupeKey),
  );
  return { ...next, isOpen: true };
}

export class DocBrowserManager {
  private readonly setSnapshot = (next: DocBrowserStateUpdate): void => {
    useDocBrowserStore.getState().setSnapshot(next);
  };

  readonly open = (url?: string, options?: DocBrowserOpenOptions): void => {
    this.setSnapshot((prev) => openDocBrowserState(prev, url, options));
  };

  readonly close = (): void => {
    this.setSnapshot((prev) => ({ ...prev, isOpen: false }));
  };

  readonly toggleMode = (): void => {
    this.setSnapshot((prev) => ({ ...prev, mode: prev.mode === 'floating' ? 'docked' : 'floating' }));
  };

  readonly navigate = (url: string): void => {
    this.setSnapshot((prev) => {
      if (!prev.tabs.length) {
        const fallbackTab = createDocBrowserTab(getDefaultDocsUrl(), 'docs', 'Docs');
        return {
          ...prev,
          tabs: [fallbackTab],
          activeTabId: fallbackTab.id,
          isOpen: true,
        };
      }

      return updateActiveTab(prev, (tab) => {
        if (tab.kind !== 'docs') {
          return tab;
        }

        const targetUrl = normalizeUrlByKind(url, 'docs');
        if (normalizeDocUrl(targetUrl) === normalizeDocUrl(tab.currentUrl)) {
          return tab;
        }

        return {
          ...tab,
          currentUrl: targetUrl,
          history: [...tab.history.slice(0, tab.historyIndex + 1), targetUrl],
          historyIndex: tab.historyIndex + 1,
          navVersion: tab.navVersion + 1,
        };
      });
    });
  };

  readonly syncUrl = (url: string): void => {
    this.setSnapshot((prev) => {
      if (!prev.tabs.length) {
        const fallbackTab = createDocBrowserTab(getDefaultDocsUrl(), 'docs', 'Docs');
        return {
          ...prev,
          tabs: [fallbackTab],
          activeTabId: fallbackTab.id,
        };
      }

      return updateActiveTab(prev, (tab) => {
        if (tab.kind !== 'docs') {
          return tab;
        }

        if (normalizeDocUrl(url) === normalizeDocUrl(tab.currentUrl)) {
          return tab;
        }

        return {
          ...tab,
          currentUrl: url,
          history: [...tab.history.slice(0, tab.historyIndex + 1), url],
          historyIndex: tab.historyIndex + 1,
        };
      });
    });
  };

  readonly goBack = (): void => {
    this.setSnapshot((prev) => updateActiveTab(prev, (tab) => {
      if (tab.kind !== 'docs' || tab.historyIndex <= 0) return tab;
      const newIndex = tab.historyIndex - 1;
      return { ...tab, historyIndex: newIndex, currentUrl: tab.history[newIndex] };
    }));
  };

  readonly goForward = (): void => {
    this.setSnapshot((prev) => updateActiveTab(prev, (tab) => {
      if (tab.kind !== 'docs' || tab.historyIndex >= tab.history.length - 1) return tab;
      const newIndex = tab.historyIndex + 1;
      return { ...tab, historyIndex: newIndex, currentUrl: tab.history[newIndex] };
    }));
  };

  readonly closeTab = (tabId: string): void => {
    this.setSnapshot((prev) => {
      if (prev.tabs.length <= 1) {
        const fallbackState = createDefaultDocBrowserState();
        return {
          ...fallbackState,
          isOpen: false,
        };
      }

      const index = prev.tabs.findIndex((tab) => tab.id === tabId);
      if (index < 0) {
        return prev;
      }

      const nextTabs = prev.tabs.filter((tab) => tab.id !== tabId);
      const nextActiveId = prev.activeTabId === tabId
        ? nextTabs[Math.max(0, index - 1)]?.id ?? nextTabs[0].id
        : prev.activeTabId;

      return {
        ...prev,
        tabs: nextTabs,
        activeTabId: nextActiveId,
      };
    });
  };

  readonly setActiveTab = (tabId: string): void => {
    this.setSnapshot((prev) => {
      if (!prev.tabs.some((tab) => tab.id === tabId)) {
        return prev;
      }
      return { ...prev, activeTabId: tabId, isOpen: true };
    });
  };
}

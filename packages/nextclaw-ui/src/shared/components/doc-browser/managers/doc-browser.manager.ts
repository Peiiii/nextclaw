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
  DOC_BROWSER_HOME_TAB_KIND,
  getDefaultDocsUrl,
} from '@/shared/components/doc-browser/utils/doc-browser-url.utils';
import {
  docBrowserRouteRegistry,
} from '@/shared/components/doc-browser/utils/doc-browser-route-registry.utils';
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

function updateTabForOpen(
  tab: DocBrowserTab,
  target: {
    kind: DocBrowserTabKind;
    title: string;
    url: string;
  },
  options?: DocBrowserOpenOptions,
  dedupeKey?: string,
): DocBrowserTab {
  const baseTab = {
    ...tab,
    title: options?.title || target.title || tab.title,
    kind: target.kind,
    dedupeKey,
  };

  if (docBrowserRouteRegistry.areUrlsEquivalent(tab.currentUrl, target.url, tab.kind, target.kind)) {
    return baseTab;
  }

  return {
    ...baseTab,
    currentUrl: target.url,
    history: [...tab.history.slice(0, tab.historyIndex + 1), target.url],
    historyIndex: tab.historyIndex + 1,
    navVersion: tab.navVersion + 1,
  };
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
  const target = docBrowserRouteRegistry.resolveOpenTarget({
    activeTab,
    kind,
    url,
  });
  const dedupeKey = rawDedupeKey?.trim() || target.dedupeKey;
  const matchedTab = dedupeKey
    ? prev.tabs.find((tab) => tab.dedupeKey === dedupeKey)
    : undefined;

  if (matchedTab) {
    const next = updateTab(
      prev,
      matchedTab.id,
      (tab) => updateTabForOpen(tab, target, options, dedupeKey),
    );
    return {
      ...next,
      activeTabId: activate === false ? prev.activeTabId : matchedTab.id,
      isOpen: true,
    };
  }

  if (shouldForceNewTab || dedupeKey || !activeTab || activeTab.kind !== target.kind) {
    const newTab = createDocBrowserTab(target.url, target.kind, title ?? target.title, dedupeKey);
    return {
      ...prev,
      isOpen: true,
      tabs: [...prev.tabs, newTab],
      activeTabId: newTab.id,
    };
  }

  const next = updateActiveTab(
    prev,
    (tab) => updateTabForOpen(tab, target, options, dedupeKey),
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

  readonly openNewTab = (): void => {
    this.open(undefined, { kind: DOC_BROWSER_HOME_TAB_KIND, newTab: true });
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
        if (!docBrowserRouteRegistry.usesManagedHistory(tab)) {
          return tab;
        }
        const target = docBrowserRouteRegistry.resolveOpenTarget({ activeTab: tab, url });

        if (docBrowserRouteRegistry.areUrlsEquivalent(tab.currentUrl, target.url, tab.kind, target.kind)) {
          return tab;
        }

        return {
          ...tab,
          currentUrl: target.url,
          dedupeKey: target.dedupeKey,
          history: [...tab.history.slice(0, tab.historyIndex + 1), target.url],
          historyIndex: tab.historyIndex + 1,
          kind: target.kind,
          navVersion: tab.navVersion + 1,
          title: target.title,
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
        if (!docBrowserRouteRegistry.usesManagedHistory(tab)) {
          return tab;
        }
        const target = docBrowserRouteRegistry.resolveOpenTarget({ activeTab: tab, kind: tab.kind, url });

        if (docBrowserRouteRegistry.areUrlsEquivalent(tab.currentUrl, target.url, tab.kind, target.kind)) {
          return tab;
        }

        return {
          ...tab,
          currentUrl: target.url,
          dedupeKey: target.dedupeKey,
          history: [...tab.history.slice(0, tab.historyIndex + 1), target.url],
          historyIndex: tab.historyIndex + 1,
          kind: target.kind,
          title: target.title,
        };
      });
    });
  };

  readonly goBack = (): void => {
    this.setSnapshot((prev) => updateActiveTab(prev, (tab) => {
      if (!docBrowserRouteRegistry.usesManagedHistory(tab) || tab.historyIndex <= 0) return tab;
      const newIndex = tab.historyIndex - 1;
      const target = docBrowserRouteRegistry.resolveOpenTarget({
        activeTab: tab,
        url: tab.history[newIndex],
      });
      return {
        ...tab,
        currentUrl: target.url,
        dedupeKey: target.dedupeKey,
        historyIndex: newIndex,
        kind: target.kind,
        title: target.title,
      };
    }));
  };

  readonly goForward = (): void => {
    this.setSnapshot((prev) => updateActiveTab(prev, (tab) => {
      if (!docBrowserRouteRegistry.usesManagedHistory(tab) || tab.historyIndex >= tab.history.length - 1) return tab;
      const newIndex = tab.historyIndex + 1;
      const target = docBrowserRouteRegistry.resolveOpenTarget({
        activeTab: tab,
        url: tab.history[newIndex],
      });
      return {
        ...tab,
        currentUrl: target.url,
        dedupeKey: target.dedupeKey,
        historyIndex: newIndex,
        kind: target.kind,
        title: target.title,
      };
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

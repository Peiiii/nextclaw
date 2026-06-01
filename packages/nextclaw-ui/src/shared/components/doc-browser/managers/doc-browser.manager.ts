import type {
  DocBrowserActiveHistoryEntry,
  DocBrowserOpenOptions,
  DocBrowserRouteResolver,
  DocBrowserRouteTarget,
  DocBrowserState,
  DocBrowserStateUpdate,
  DocBrowserTab,
} from '@/shared/components/doc-browser/types/doc-browser.types';
import {
  createDocBrowserActiveHistoryEntry,
  createDefaultDocBrowserState,
  createDocBrowserTab,
} from '@/shared/components/doc-browser/utils/doc-browser-state.utils';
import {
  DOC_BROWSER_HOME_TAB_KIND,
  getDefaultDocsUrl,
} from '@/shared/components/doc-browser/utils/doc-browser-url.utils';
import { DefaultDocBrowserRouteResolver } from '@/shared/components/doc-browser/utils/doc-browser-route-resolver.utils';
import { useDocBrowserStore } from '@/shared/components/doc-browser/stores/doc-browser.store';

const defaultDocBrowserRouteResolver = new DefaultDocBrowserRouteResolver();

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

function appendManualNavigation(tab: DocBrowserTab, url: string): Pick<DocBrowserTab, 'history' | 'historyIndex'> {
  const history = [...tab.history.slice(0, tab.historyIndex + 1), url];
  return {
    history,
    historyIndex: history.length - 1,
  };
}

function areActiveHistoryEntriesEquivalent(
  routeResolver: DocBrowserRouteResolver,
  current: DocBrowserActiveHistoryEntry,
  next: DocBrowserActiveHistoryEntry,
): boolean {
  return current.tabId === next.tabId
    && current.kind === next.kind
    && routeResolver.areUrlsEquivalent(current.url, next.url, current.kind, next.kind);
}

function pushActiveHistory(
  routeResolver: DocBrowserRouteResolver,
  state: DocBrowserState,
  entry: DocBrowserActiveHistoryEntry,
): DocBrowserState {
  const current = state.activeHistory[state.activeHistoryIndex];
  if (current && areActiveHistoryEntriesEquivalent(routeResolver, current, entry)) {
    return state;
  }
  const activeHistory = [...state.activeHistory.slice(0, state.activeHistoryIndex + 1), entry];
  return {
    ...state,
    activeHistory,
    activeHistoryIndex: activeHistory.length - 1,
  };
}

function findTabHistoryIndex(routeResolver: DocBrowserRouteResolver, tab: DocBrowserTab, url: string): number {
  for (let index = tab.history.length - 1; index >= 0; index -= 1) {
    if (routeResolver.areUrlsEquivalent(tab.history[index], url, tab.kind, tab.kind)) {
      return index;
    }
  }
  return -1;
}

function restoreActiveHistoryEntry(
  routeResolver: DocBrowserRouteResolver,
  state: DocBrowserState,
  entry: DocBrowserActiveHistoryEntry,
): DocBrowserState {
  const tab = state.tabs.find((item) => item.id === entry.tabId);
  if (!tab) {
    return state;
  }
  const target = routeResolver.resolveOpenTarget({
    activeTab: tab,
    kind: entry.kind,
    url: entry.url,
  });
  const historyIndex = findTabHistoryIndex(routeResolver, tab, target.url);
  return updateTab(
    {
      ...state,
      activeTabId: tab.id,
      isOpen: true,
    },
    tab.id,
    (currentTab) => ({
      ...currentTab,
      currentUrl: target.url,
      dedupeKey: target.dedupeKey,
      historyIndex: historyIndex >= 0 ? historyIndex : currentTab.historyIndex,
      kind: target.kind,
      title: target.title,
    }),
  );
}

function updateTabForOpen(
  routeResolver: DocBrowserRouteResolver,
  tab: DocBrowserTab,
  target: DocBrowserRouteTarget,
  options?: DocBrowserOpenOptions,
  dedupeKey?: string,
): DocBrowserTab {
  const baseTab = {
    ...tab,
    title: options?.title || target.title || tab.title,
    kind: target.kind,
    dedupeKey,
  };

  if (routeResolver.areUrlsEquivalent(tab.currentUrl, target.url, tab.kind, target.kind)) {
    return baseTab;
  }

  return {
    ...baseTab,
    currentUrl: target.url,
    ...appendManualNavigation(tab, target.url),
    navVersion: tab.navVersion + 1,
  };
}

function openResolvedDocBrowserState(
  routeResolver: DocBrowserRouteResolver,
  prev: DocBrowserState,
  target: DocBrowserRouteTarget,
  options?: DocBrowserOpenOptions,
): DocBrowserState {
  const {
    activate,
    dedupeKey: rawDedupeKey,
    newTab: shouldForceNewTab,
    title,
  } = options ?? {};
  const dedupeKey = rawDedupeKey?.trim() || target.dedupeKey;
  const activeTab = prev.tabs.find((tab) => tab.id === prev.activeTabId) ?? prev.tabs[0];
  const matchedTab = dedupeKey
    ? prev.tabs.find((tab) => tab.dedupeKey === dedupeKey)
    : undefined;

  if (matchedTab) {
    const next = updateTab(
      prev,
      matchedTab.id,
      (tab) => updateTabForOpen(routeResolver, tab, target, options, dedupeKey),
    );
    const shouldActivate = activate !== false;
    const activeTabId = shouldActivate ? matchedTab.id : prev.activeTabId;
    const nextState = {
      ...next,
      activeTabId,
      isOpen: true,
    };
    const shouldPushActiveHistory = shouldActivate || matchedTab.id === prev.activeTabId;
    return shouldPushActiveHistory
      ? pushActiveHistory(routeResolver, nextState, { kind: target.kind, tabId: matchedTab.id, url: target.url })
      : nextState;
  }

  if (shouldForceNewTab || dedupeKey || !activeTab || activeTab.kind !== target.kind) {
    const newTab = createDocBrowserTab(target.url, target.kind, title ?? target.title, dedupeKey);
    const nextState = {
      ...prev,
      isOpen: true,
      tabs: [...prev.tabs, newTab],
      activeTabId: newTab.id,
    };
    return pushActiveHistory(routeResolver, nextState, createDocBrowserActiveHistoryEntry(newTab));
  }

  const next = updateActiveTab(
    prev,
    (tab) => updateTabForOpen(routeResolver, tab, target, options, dedupeKey),
  );
  return pushActiveHistory(
    routeResolver,
    { ...next, isOpen: true },
    { kind: target.kind, tabId: prev.activeTabId, url: target.url },
  );
}

function openDocBrowserState(
  routeResolver: DocBrowserRouteResolver,
  prev: DocBrowserState,
  url?: string,
  options?: DocBrowserOpenOptions,
): DocBrowserState {
  const activeTab = prev.tabs.find((tab) => tab.id === prev.activeTabId) ?? prev.tabs[0];
  const target = routeResolver.resolveOpenTarget({
    activeTab,
    kind: options?.kind,
    url,
  });
  return openResolvedDocBrowserState(routeResolver, prev, target, options);
}

export class DocBrowserManager {
  constructor(private readonly routeResolver: DocBrowserRouteResolver = defaultDocBrowserRouteResolver) {}

  private readonly setSnapshot = (next: DocBrowserStateUpdate): void => {
    useDocBrowserStore.getState().setSnapshot(next);
  };

  readonly open = (url?: string, options?: DocBrowserOpenOptions): void => {
    this.setSnapshot((prev) => openDocBrowserState(this.routeResolver, prev, url, options));
  };

  readonly openTarget = (target: DocBrowserRouteTarget, options?: DocBrowserOpenOptions): void => {
    this.setSnapshot((prev) => openResolvedDocBrowserState(this.routeResolver, prev, target, {
      ...options,
      dedupeKey: options?.dedupeKey ?? target.dedupeKey,
      kind: options?.kind ?? target.kind,
      title: options?.title ?? target.title,
    }));
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

      const next = updateActiveTab(prev, (tab) => {
        if (!this.routeResolver.usesManagedHistory(tab)) {
          return tab;
        }
        const target = this.routeResolver.resolveOpenTarget({ activeTab: tab, url });

        if (this.routeResolver.areUrlsEquivalent(tab.currentUrl, target.url, tab.kind, target.kind)) {
          return tab;
        }

        return {
          ...tab,
          currentUrl: target.url,
          dedupeKey: target.dedupeKey,
          ...appendManualNavigation(tab, target.url),
          kind: target.kind,
          navVersion: tab.navVersion + 1,
          title: target.title,
        };
      });
      const currentTab = next.tabs.find((tab) => tab.id === next.activeTabId);
      return currentTab
        ? pushActiveHistory(this.routeResolver, next, createDocBrowserActiveHistoryEntry(currentTab))
        : next;
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

      const next = updateActiveTab(prev, (tab) => {
        if (!this.routeResolver.usesManagedHistory(tab)) {
          return tab;
        }
        const target = this.routeResolver.resolveOpenTarget({ activeTab: tab, kind: tab.kind, url });

        if (this.routeResolver.areUrlsEquivalent(tab.currentUrl, target.url, tab.kind, target.kind)) {
          return tab;
        }

        return {
          ...tab,
          currentUrl: target.url,
          dedupeKey: target.dedupeKey,
          ...appendManualNavigation(tab, target.url),
          kind: target.kind,
          title: target.title,
        };
      });
      const currentTab = next.tabs.find((tab) => tab.id === next.activeTabId);
      return currentTab
        ? pushActiveHistory(this.routeResolver, next, createDocBrowserActiveHistoryEntry(currentTab))
        : next;
    });
  };

  readonly goBack = (): void => {
    this.setSnapshot((prev) => {
      if (prev.activeHistoryIndex <= 0) {
        return prev;
      }
      const activeHistoryIndex = prev.activeHistoryIndex - 1;
      const entry = prev.activeHistory[activeHistoryIndex];
      if (!entry) {
        return prev;
      }
      return restoreActiveHistoryEntry(this.routeResolver, { ...prev, activeHistoryIndex }, entry);
    });
  };

  readonly goForward = (): void => {
    this.setSnapshot((prev) => {
      if (prev.activeHistoryIndex >= prev.activeHistory.length - 1) {
        return prev;
      }
      const activeHistoryIndex = prev.activeHistoryIndex + 1;
      const entry = prev.activeHistory[activeHistoryIndex];
      if (!entry) {
        return prev;
      }
      return restoreActiveHistoryEntry(this.routeResolver, { ...prev, activeHistoryIndex }, entry);
    });
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

      const nextState = {
        ...prev,
        tabs: nextTabs,
        activeTabId: nextActiveId,
      };
      const activeHistory = nextState.activeHistory.filter((entry) => entry.tabId !== tabId);
      const activeHistoryBeforeIndex = nextState.activeHistory
        .slice(0, nextState.activeHistoryIndex + 1)
        .filter((entry) => entry.tabId !== tabId);
      const nextActiveTab = nextTabs.find((tab) => tab.id === nextActiveId) ?? nextTabs[0];
      const reconciledState = {
        ...nextState,
        activeHistory: activeHistory.length > 0
          ? activeHistory
          : [createDocBrowserActiveHistoryEntry(nextActiveTab)],
        activeHistoryIndex: Math.min(
          Math.max(0, activeHistoryBeforeIndex.length - 1),
          Math.max(0, activeHistory.length - 1),
        ),
      };
      return prev.activeTabId === tabId
        ? pushActiveHistory(this.routeResolver, reconciledState, createDocBrowserActiveHistoryEntry(nextActiveTab))
        : reconciledState;
    });
  };

  readonly setActiveTab = (tabId: string): void => {
    this.setSnapshot((prev) => {
      if (!prev.tabs.some((tab) => tab.id === tabId)) {
        return prev;
      }
      const tab = prev.tabs.find((item) => item.id === tabId);
      if (!tab) {
        return prev;
      }
      return pushActiveHistory(
        this.routeResolver,
        { ...prev, activeTabId: tabId, isOpen: true },
        createDocBrowserActiveHistoryEntry(tab),
      );
    });
  };
}

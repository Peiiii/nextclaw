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
  normalizeDocBrowserDockedWidth,
} from '@/shared/components/doc-browser/utils/doc-browser-state.utils';
import {
  DOC_BROWSER_HOME_TAB_KIND,
  DOC_BROWSER_HOME_URL,
  getDefaultDocsUrl,
} from '@/shared/components/doc-browser/utils/doc-browser-url.utils';
import { DefaultDocBrowserRouteResolver } from '@/shared/components/doc-browser/utils/doc-browser-route-resolver.utils';
import { useDocBrowserStore } from '@/shared/components/doc-browser/stores/doc-browser.store';
import {
  filterNavigationHistoryEntries,
  pushNavigationHistoryEntry,
  stepNavigationHistory,
} from '@/shared/lib/navigation-history';

const defaultDocBrowserRouteResolver = new DefaultDocBrowserRouteResolver();

type RightPanelOpenedHandler = () => void;

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
  const currentUri = current.resourceUri ?? current.url;
  const nextUri = next.resourceUri ?? next.url;
  return current.tabId === next.tabId
    && current.kind === next.kind
    && routeResolver.areUrlsEquivalent(currentUri, nextUri, current.kind, next.kind);
}

function createActiveHistoryEntryFromTarget(
  tabId: string,
  target: DocBrowserRouteTarget,
): DocBrowserActiveHistoryEntry {
  return {
    kind: target.kind,
    resourceUri: target.resourceUri ?? target.url,
    tabId,
    url: target.url,
  };
}

function pushActiveHistory(
  routeResolver: DocBrowserRouteResolver,
  state: DocBrowserState,
  entry: DocBrowserActiveHistoryEntry,
): DocBrowserState {
  const activeHistory = pushNavigationHistoryEntry(
    { entries: state.activeHistory, index: state.activeHistoryIndex },
    entry,
    (current, next) => areActiveHistoryEntriesEquivalent(routeResolver, current, next),
  );
  return {
    ...state,
    activeHistory: [...activeHistory.entries],
    activeHistoryIndex: activeHistory.index,
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
  const restoreUri = entry.resourceUri ?? entry.url;
  const target = routeResolver.resolveOpenTarget({
    activeTab: tab,
    kind: entry.kind,
    url: restoreUri,
  });
  const historyIndex = findTabHistoryIndex(routeResolver, tab, target.url);
  const shouldPreserveCurrentTitle = entry.resourceUri !== undefined && entry.resourceUri === tab.resourceUri;
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
      dockIcon: target.dockIcon ?? currentTab.dockIcon,
      historyIndex: historyIndex >= 0 ? historyIndex : currentTab.historyIndex,
      kind: target.kind,
      resourceUri: target.resourceUri ?? target.url,
      title: shouldPreserveCurrentTitle ? currentTab.title : target.title,
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
    resourceUri: target.resourceUri ?? target.url,
    dockIcon: options?.dockIcon ?? target.dockIcon,
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

function isClosedDefaultHomeState(state: DocBrowserState, activeTab?: DocBrowserTab): boolean {
  return !state.isOpen
    && state.tabs.length === 1
    && activeTab?.kind === DOC_BROWSER_HOME_TAB_KIND
    && activeTab.currentUrl === DOC_BROWSER_HOME_URL;
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
      ? pushActiveHistory(routeResolver, nextState, createActiveHistoryEntryFromTarget(matchedTab.id, target))
      : nextState;
  }

  if (shouldForceNewTab || dedupeKey || !activeTab || activeTab.kind !== target.kind) {
    const newTab = createDocBrowserTab(target.url, target.kind, title ?? target.title, dedupeKey, target.resourceUri ?? target.url, options?.dockIcon ?? target.dockIcon);
    if (isClosedDefaultHomeState(prev, activeTab)) {
      const nextState = {
        ...prev,
        isOpen: true,
        tabs: [newTab],
        activeTabId: newTab.id,
        activeHistory: [createDocBrowserActiveHistoryEntry(newTab)],
        activeHistoryIndex: 0,
      };
      return nextState;
    }
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
    createActiveHistoryEntryFromTarget(prev.activeTabId, target),
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
  constructor(
    private readonly routeResolver: DocBrowserRouteResolver = defaultDocBrowserRouteResolver,
    private readonly onRightPanelOpened?: RightPanelOpenedHandler,
  ) {}

  private readonly setSnapshot = (next: DocBrowserStateUpdate): void => {
    useDocBrowserStore.getState().setSnapshot(next);
  };

  readonly open = (url?: string, options?: DocBrowserOpenOptions): void => {
    this.setSnapshot((prev) => openDocBrowserState(this.routeResolver, prev, url, options));
    this.onRightPanelOpened?.();
  };

  readonly openTarget = (target: DocBrowserRouteTarget, options?: DocBrowserOpenOptions): void => {
    this.setSnapshot((prev) => openResolvedDocBrowserState(this.routeResolver, prev, target, {
      ...options,
      dedupeKey: options?.dedupeKey ?? target.dedupeKey,
      kind: options?.kind ?? target.kind,
      title: options?.title ?? target.title,
    }));
    this.onRightPanelOpened?.();
  };

  readonly openNewTab = (): void => {
    this.open(undefined, { kind: DOC_BROWSER_HOME_TAB_KIND, newTab: true });
  };

  readonly close = (): void => {
    this.setSnapshot((prev) => ({ ...prev, isOpen: false }));
  };

  readonly toggleMode = (): void => {
    this.setSnapshot((prev) => ({ ...prev, mode: prev.mode === 'floating' ? 'docked' : 'floating' }));
    this.onRightPanelOpened?.();
  };

  readonly setDockedWidth = (width: number): void => {
    this.setSnapshot((prev) => ({ ...prev, dockedWidth: normalizeDocBrowserDockedWidth(width) }));
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
          dockIcon: target.dockIcon,
          ...appendManualNavigation(tab, target.url),
          kind: target.kind,
          navVersion: tab.navVersion + 1,
          resourceUri: target.resourceUri ?? target.url,
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
          dockIcon: target.dockIcon,
          ...appendManualNavigation(tab, target.url),
          kind: target.kind,
          resourceUri: target.resourceUri ?? target.url,
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
      const step = stepNavigationHistory(
        { entries: prev.activeHistory, index: prev.activeHistoryIndex },
        'back',
      );
      if (!step) {
        return prev;
      }
      return restoreActiveHistoryEntry(this.routeResolver, {
        ...prev,
        activeHistory: [...step.history.entries],
        activeHistoryIndex: step.history.index,
      }, step.entry);
    });
  };

  readonly goForward = (): void => {
    this.setSnapshot((prev) => {
      const step = stepNavigationHistory(
        { entries: prev.activeHistory, index: prev.activeHistoryIndex },
        'forward',
      );
      if (!step) {
        return prev;
      }
      return restoreActiveHistoryEntry(this.routeResolver, {
        ...prev,
        activeHistory: [...step.history.entries],
        activeHistoryIndex: step.history.index,
      }, step.entry);
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
      const nextActiveTab = nextTabs.find((tab) => tab.id === nextActiveId) ?? nextTabs[0];
      const activeHistory = filterNavigationHistoryEntries(
        { entries: nextState.activeHistory, index: nextState.activeHistoryIndex },
        (entry) => entry.tabId !== tabId,
        createDocBrowserActiveHistoryEntry(nextActiveTab),
      );
      const reconciledState = {
        ...nextState,
        activeHistory: [...activeHistory.entries],
        activeHistoryIndex: activeHistory.index,
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

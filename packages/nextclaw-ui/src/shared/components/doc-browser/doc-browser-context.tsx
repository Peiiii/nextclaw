import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getLanguage, type I18nLanguage } from '@/shared/lib/i18n';

const DOCS_PRIMARY_DOMAIN = 'docs.nextclaw.io';
const DOCS_PAGES_DEV = 'nextclaw-docs.pages.dev';
const DOCS_HOSTS = new Set([
  DOCS_PRIMARY_DOMAIN,
  `www.${DOCS_PRIMARY_DOMAIN}`,
  DOCS_PAGES_DEV,
  `www.${DOCS_PAGES_DEV}`,
]);

export const DOCS_DEFAULT_BASE_URL = `https://${DOCS_PRIMARY_DOMAIN}`;
const DOCS_DEFAULT_GUIDE_PATH = '/guide/getting-started';

export type DocBrowserMode = 'floating' | 'docked';
export type DocBrowserTabKind = 'docs' | 'content';

export type DocBrowserTab = {
  id: string;
  kind: DocBrowserTabKind;
  title: string;
  currentUrl: string;
  dedupeKey?: string;
  history: string[];
  historyIndex: number;
  /** Increments on parent-initiated navigation to trigger iframe remount */
  navVersion: number;
};

export type DocBrowserOpenOptions = {
  activate?: boolean;
  dedupeKey?: string;
  newTab?: boolean;
  title?: string;
  kind?: DocBrowserTabKind;
};

type DocBrowserState = {
  isOpen: boolean;
  mode: DocBrowserMode;
  tabs: DocBrowserTab[];
  activeTabId: string;
};

interface DocBrowserActions {
  open: (url?: string, options?: DocBrowserOpenOptions) => void;
  close: () => void;
  toggleMode: () => void;
  setMode: (mode: DocBrowserMode) => void;
  navigate: (url: string) => void;
  syncUrl: (url: string) => void;
  goBack: () => void;
  goForward: () => void;
  openNewTab: (url?: string, options?: Omit<DocBrowserOpenOptions, 'newTab'>) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
}

type DocBrowserContextValue = DocBrowserState & DocBrowserActions & {
  currentUrl: string;
  currentTab?: DocBrowserTab;
  navVersion: number;
};

const DocBrowserContext = createContext<DocBrowserContextValue | null>(null);

let tabCounter = 0;

function nextTabId(): string {
  tabCounter += 1;
  return `doc-tab-${Date.now()}-${tabCounter}`;
}

/** Normalize URL for comparison: strip .html and trailing slash */
function normalizeDocUrl(u: string): string {
  try {
    return new URL(u).pathname.replace(/\.html$/, '').replace(/\/$/, '');
  } catch {
    return u;
  }
}

function toDocsLocale(language: I18nLanguage): 'en' | 'zh' {
  return language === 'zh' ? 'zh' : 'en';
}

function ensureLocalizedDocsPath(pathname: string, locale: 'en' | 'zh'): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (normalized === '/' || normalized === '') {
    return `/${locale}/`;
  }

  if (/^\/(en|zh)(\/|$)/.test(normalized)) {
    return normalized;
  }

  return `/${locale}${normalized}`;
}

function resolveLocalizedDocsUrl(url: string): string {
  const locale = toDocsLocale(getLanguage());

  try {
    const parsed = new URL(url, DOCS_DEFAULT_BASE_URL);
    if (!DOCS_HOSTS.has(parsed.hostname)) {
      return parsed.toString();
    }

    parsed.pathname = ensureLocalizedDocsPath(parsed.pathname, locale);
    return parsed.toString();
  } catch {
    return new URL(`/${locale}${DOCS_DEFAULT_GUIDE_PATH}`, DOCS_DEFAULT_BASE_URL).toString();
  }
}

function getDefaultDocsUrl(): string {
  return resolveLocalizedDocsUrl(DOCS_DEFAULT_GUIDE_PATH);
}

function inferTabTitle(url: string, kind: DocBrowserTabKind, fallback = 'Docs'): string {
  try {
    const parsed = new URL(url, DOCS_DEFAULT_BASE_URL);
    if (parsed.protocol === 'data:') {
      return kind === 'docs' ? fallback : 'Detail';
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    const leaf = segments[segments.length - 1] ?? fallback;
    return decodeURIComponent(leaf).replace(/[-_]/g, ' ').slice(0, 40) || fallback;
  } catch {
    return fallback;
  }
}

function createTab(
  url: string,
  kind: DocBrowserTabKind,
  title?: string,
  dedupeKey?: string,
): DocBrowserTab {
  const tabTitle = title?.trim() || inferTabTitle(url, kind, kind === 'docs' ? 'Docs' : 'Detail');

  return {
    id: nextTabId(),
    kind,
    title: tabTitle,
    currentUrl: url,
    dedupeKey,
    history: [url],
    historyIndex: 0,
    navVersion: 0,
  };
}

function updateActiveTab(state: DocBrowserState, updater: (tab: DocBrowserTab) => DocBrowserTab): DocBrowserState {
  return updateTab(state, state.activeTabId, updater);
}

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

  if (normalizeDocUrl(url) === normalizeDocUrl(tab.currentUrl)) {
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

export function useDocBrowser(): DocBrowserContextValue {
  const ctx = useContext(DocBrowserContext);
  if (!ctx) throw new Error('useDocBrowser must be used within DocBrowserProvider');
  return ctx;
}

/** Check if a URL belongs to the docs domain */
export function isDocsUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return DOCS_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function inferTabKind(url: string): DocBrowserTabKind {
  return isDocsUrl(url) ? 'docs' : 'content';
}

function normalizeUrlByKind(url: string, kind: DocBrowserTabKind): string {
  if (kind === 'docs') {
    return resolveLocalizedDocsUrl(url);
  }
  return url;
}

function resolveOpenTargetUrl(params: {
  url?: string;
  kind: DocBrowserTabKind;
  activeTab?: DocBrowserTab;
}): string {
  if (params.url && params.url.trim().length > 0) {
    return normalizeUrlByKind(params.url, params.kind);
  }

  if (params.kind === 'docs') {
    return getDefaultDocsUrl();
  }

  return params.activeTab?.currentUrl ?? getDefaultDocsUrl();
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
    const newTab = createTab(targetUrl, targetKind, title, dedupeKey);
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

export function DocBrowserProvider({ children }: { children: ReactNode }) {
  const initialUrl = getDefaultDocsUrl();
  const initialTab = createTab(initialUrl, 'docs', 'Docs');

  const [state, setState] = useState<DocBrowserState>({
    isOpen: false,
    mode: 'docked',
    tabs: [initialTab],
    activeTabId: initialTab.id,
  });

  const currentTab = useMemo(() => {
    return state.tabs.find((tab) => tab.id === state.activeTabId) ?? state.tabs[0];
  }, [state.tabs, state.activeTabId]);

  const open = useCallback((url?: string, options?: DocBrowserOpenOptions) => {
    setState((prev) => openDocBrowserState(prev, url, options));
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const toggleMode = useCallback(() => {
    setState((prev) => ({ ...prev, mode: prev.mode === 'floating' ? 'docked' : 'floating' }));
  }, []);

  const setMode = useCallback((mode: DocBrowserMode) => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  const navigate = useCallback((url: string) => {
    setState((prev) => {
      if (!prev.tabs.length) {
        const fallbackTab = createTab(getDefaultDocsUrl(), 'docs', 'Docs');
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
  }, []);

  const syncUrl = useCallback((url: string) => {
    setState((prev) => {
      if (!prev.tabs.length) {
        const fallbackTab = createTab(getDefaultDocsUrl(), 'docs', 'Docs');
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
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => updateActiveTab(prev, (tab) => {
      if (tab.kind !== 'docs' || tab.historyIndex <= 0) return tab;
      const newIndex = tab.historyIndex - 1;
      return { ...tab, historyIndex: newIndex, currentUrl: tab.history[newIndex] };
    }));
  }, []);

  const goForward = useCallback(() => {
    setState((prev) => updateActiveTab(prev, (tab) => {
      if (tab.kind !== 'docs' || tab.historyIndex >= tab.history.length - 1) return tab;
      const newIndex = tab.historyIndex + 1;
      return { ...tab, historyIndex: newIndex, currentUrl: tab.history[newIndex] };
    }));
  }, []);

  const openNewTab = useCallback((url?: string, options?: Omit<DocBrowserOpenOptions, 'newTab'>) => {
    open(url, { ...(options ?? {}), newTab: true });
  }, [open]);

  const closeTab = useCallback((tabId: string) => {
    setState((prev) => {
      if (prev.tabs.length <= 1) {
        const fallbackTab = createTab(getDefaultDocsUrl(), 'docs', 'Docs');
        return {
          ...prev,
          isOpen: false,
          tabs: [fallbackTab],
          activeTabId: fallbackTab.id,
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
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    setState((prev) => {
      if (!prev.tabs.some((tab) => tab.id === tabId)) {
        return prev;
      }
      return { ...prev, activeTabId: tabId, isOpen: true };
    });
  }, []);

  const canGoBack = Boolean(currentTab && currentTab.kind === 'docs' && currentTab.historyIndex > 0);
  const canGoForward = Boolean(currentTab && currentTab.kind === 'docs' && currentTab.historyIndex < currentTab.history.length - 1);

  const value = useMemo<DocBrowserContextValue>(() => ({
    ...state,
    currentTab,
    currentUrl: currentTab?.currentUrl ?? getDefaultDocsUrl(),
    navVersion: currentTab?.navVersion ?? 0,
    open,
    close,
    toggleMode,
    setMode,
    navigate,
    syncUrl,
    goBack,
    goForward,
    openNewTab,
    closeTab,
    setActiveTab,
    canGoBack,
    canGoForward,
  }), [
    state,
    currentTab,
    open,
    close,
    toggleMode,
    setMode,
    navigate,
    syncUrl,
    goBack,
    goForward,
    openNewTab,
    closeTab,
    setActiveTab,
    canGoBack,
    canGoForward,
  ]);

  return (
    <DocBrowserContext.Provider value={value}>
      {children}
    </DocBrowserContext.Provider>
  );
}

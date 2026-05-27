import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';
import { useDocBrowserStore } from '@/shared/components/doc-browser/stores/doc-browser.store';
import type { DocBrowserContextValue } from '@/shared/components/doc-browser/types/doc-browser.types';

export type {
  DocBrowserActions,
  DocBrowserContextValue,
  DocBrowserMode,
  DocBrowserOpenOptions,
  DocBrowserState,
  DocBrowserStateUpdate,
  DocBrowserTab,
  DocBrowserTabKind,
} from '@/shared/components/doc-browser/types/doc-browser.types';
export {
  DOCS_DEFAULT_BASE_URL,
  isDocsUrl,
} from '@/shared/components/doc-browser/utils/doc-browser-url.utils';

const DocBrowserContext = createContext<DocBrowserContextValue | null>(null);
const docBrowserManager = new DocBrowserManager();

export function useDocBrowser(): DocBrowserContextValue {
  const ctx = useContext(DocBrowserContext);
  if (!ctx) throw new Error('useDocBrowser must be used within DocBrowserProvider');
  return ctx;
}

export function DocBrowserProvider({ children }: { children: ReactNode }) {
  const snapshot = useDocBrowserStore((state) => state.snapshot);
  const currentTab = useMemo(() => {
    return snapshot.tabs.find((tab) => tab.id === snapshot.activeTabId) ?? snapshot.tabs[0];
  }, [snapshot.activeTabId, snapshot.tabs]);

  const value = useMemo<DocBrowserContextValue>(() => ({
    ...snapshot,
    currentTab,
    open: docBrowserManager.open,
    close: docBrowserManager.close,
    toggleMode: docBrowserManager.toggleMode,
    navigate: docBrowserManager.navigate,
    syncUrl: docBrowserManager.syncUrl,
    goBack: docBrowserManager.goBack,
    goForward: docBrowserManager.goForward,
    closeTab: docBrowserManager.closeTab,
    setActiveTab: docBrowserManager.setActiveTab,
  }), [currentTab, snapshot]);

  return (
    <DocBrowserContext.Provider value={value}>
      {children}
    </DocBrowserContext.Provider>
  );
}

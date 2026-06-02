import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';
import { useDocBrowserStore } from '@/shared/components/doc-browser/stores/doc-browser.store';
import type { DocBrowserContextValue } from '@/shared/components/doc-browser/types/doc-browser.types';

export type {
  DocBrowserActions,
  DocBrowserContextValue,
  DocBrowserDockControls,
  DocBrowserDockIcon,
  DocBrowserDockState,
  DocBrowserMode,
  DocBrowserOpenOptions,
  DocBrowserRouteResolver,
  DocBrowserRouteTarget,
  DocBrowserState,
  DocBrowserStateUpdate,
  DocBrowserTab,
  DocBrowserTabKind,
} from '@/shared/components/doc-browser/types/doc-browser.types';
export {
  DOC_BROWSER_HOME_TAB_KIND,
  DOC_BROWSER_HOME_URL,
  DOCS_DEFAULT_BASE_URL,
  isDocsUrl,
} from '@/shared/components/doc-browser/utils/doc-browser-url.utils';

const DocBrowserContext = createContext<DocBrowserContextValue | null>(null);

export function useDocBrowser(): DocBrowserContextValue {
  const ctx = useContext(DocBrowserContext);
  if (!ctx) throw new Error('useDocBrowser must be used within DocBrowserProvider');
  return ctx;
}

export function DocBrowserProvider({
  children,
  manager,
}: {
  children: ReactNode;
  manager: DocBrowserManager;
}) {
  const snapshot = useDocBrowserStore((state) => state.snapshot);
  const currentTab = useMemo(() => {
    return snapshot.tabs.find((tab) => tab.id === snapshot.activeTabId) ?? snapshot.tabs[0];
  }, [snapshot.activeTabId, snapshot.tabs]);

  const value = useMemo<DocBrowserContextValue>(() => ({
    ...snapshot,
    currentTab,
    open: manager.open,
    openTarget: manager.openTarget,
    openNewTab: manager.openNewTab,
    close: manager.close,
    toggleMode: manager.toggleMode,
    navigate: manager.navigate,
    syncUrl: manager.syncUrl,
    goBack: manager.goBack,
    goForward: manager.goForward,
    closeTab: manager.closeTab,
    setActiveTab: manager.setActiveTab,
  }), [currentTab, manager, snapshot]);

  return (
    <DocBrowserContext.Provider value={value}>
      {children}
    </DocBrowserContext.Provider>
  );
}

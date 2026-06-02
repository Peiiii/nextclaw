import type {
  DocBrowserActiveHistoryEntry,
  DocBrowserState,
  DocBrowserTab,
  DocBrowserTabKind,
} from '@/shared/components/doc-browser/types/doc-browser.types';
import {
  DOC_BROWSER_HOME_TAB_KIND,
  DOC_BROWSER_HOME_URL,
  inferTabTitle,
} from './doc-browser-url.utils';
import { t } from '@/shared/lib/i18n';

let tabCounter = 0;

function nextTabId(): string {
  tabCounter += 1;
  return `doc-tab-${Date.now()}-${tabCounter}`;
}

export function createDocBrowserTab(
  url: string,
  kind: DocBrowserTabKind,
  title?: string,
  dedupeKey?: string,
): DocBrowserTab {
  const tabTitle = title?.trim() || inferTabTitle(url, kind, kind === 'docs' ? t('docBrowserHelp') : 'Detail');

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

export function createDocBrowserActiveHistoryEntry(tab: DocBrowserTab): DocBrowserActiveHistoryEntry {
  return {
    kind: tab.kind,
    tabId: tab.id,
    url: tab.currentUrl,
  };
}

export function createDefaultDocBrowserState(): DocBrowserState {
  const initialTab = createDocBrowserTab(DOC_BROWSER_HOME_URL, DOC_BROWSER_HOME_TAB_KIND, t('docBrowserHomeTitle'));
  return {
    isOpen: false,
    mode: 'docked',
    tabs: [initialTab],
    activeTabId: initialTab.id,
    activeHistory: [createDocBrowserActiveHistoryEntry(initialTab)],
    activeHistoryIndex: 0,
  };
}

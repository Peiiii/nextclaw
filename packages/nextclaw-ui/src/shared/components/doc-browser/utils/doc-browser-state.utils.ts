import type {
  DocBrowserActiveHistoryEntry,
  DocBrowserDockIcon,
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

export const DOC_BROWSER_DOCKED_DEFAULT_WIDTH = 420;
export const DOC_BROWSER_DOCKED_MIN_WIDTH = 320;
export const DOC_BROWSER_DOCKED_MAX_WIDTH = 860;

let tabCounter = 0;

export function normalizeDocBrowserDockedWidth(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(DOC_BROWSER_DOCKED_MAX_WIDTH, Math.max(DOC_BROWSER_DOCKED_MIN_WIDTH, value))
    : DOC_BROWSER_DOCKED_DEFAULT_WIDTH;
}

function nextTabId(): string {
  tabCounter += 1;
  return `doc-tab-${Date.now()}-${tabCounter}`;
}

export function createDocBrowserTab(
  url: string,
  kind: DocBrowserTabKind,
  title?: string,
  dedupeKey?: string,
  resourceUri?: string,
  dockIcon?: DocBrowserDockIcon,
): DocBrowserTab {
  const tabTitle = title?.trim() || inferTabTitle(url, kind, kind === 'docs' ? t('docBrowserHelp') : 'Detail');
  const normalizedResourceUri = resourceUri?.trim();

  return {
    id: nextTabId(),
    kind,
    title: tabTitle,
    currentUrl: url,
    resourceUri: normalizedResourceUri ? normalizedResourceUri : undefined,
    dockIcon,
    dedupeKey,
    history: [url],
    historyIndex: 0,
    navVersion: 0,
  };
}

export function createDocBrowserActiveHistoryEntry(tab: DocBrowserTab): DocBrowserActiveHistoryEntry {
  return {
    kind: tab.kind,
    resourceUri: tab.resourceUri,
    tabId: tab.id,
    url: tab.currentUrl,
  };
}

export function createDefaultDocBrowserState(): DocBrowserState {
  const initialTab = createDocBrowserTab(DOC_BROWSER_HOME_URL, DOC_BROWSER_HOME_TAB_KIND, t('docBrowserHomeTitle'));
  return {
    isOpen: false,
    mode: 'docked',
    dockedWidth: DOC_BROWSER_DOCKED_DEFAULT_WIDTH,
    tabs: [initialTab],
    activeTabId: initialTab.id,
    activeHistory: [createDocBrowserActiveHistoryEntry(initialTab)],
    activeHistoryIndex: 0,
  };
}

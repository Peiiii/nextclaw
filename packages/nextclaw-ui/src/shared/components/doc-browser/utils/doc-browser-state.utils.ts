import type {
  DocBrowserState,
  DocBrowserTab,
  DocBrowserTabKind,
} from '@/shared/components/doc-browser/types/doc-browser.types';
import {
  getDefaultDocsUrl,
  inferTabTitle,
} from './doc-browser-url.utils';

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

export function createDefaultDocBrowserState(): DocBrowserState {
  const initialUrl = getDefaultDocsUrl();
  const initialTab = createDocBrowserTab(initialUrl, 'docs', 'Docs');
  return {
    isOpen: false,
    mode: 'docked',
    tabs: [initialTab],
    activeTabId: initialTab.id,
  };
}

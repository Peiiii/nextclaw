import type {
  DocBrowserRouteResolver,
  DocBrowserRouteTarget,
  DocBrowserTab,
  DocBrowserTabKind,
} from '@/shared/components/doc-browser/types/doc-browser.types';
import {
  DOCS_DEFAULT_BASE_URL,
  DOC_BROWSER_HOME_TAB_KIND,
  DOC_BROWSER_HOME_URL,
  getDefaultDocsUrl,
  inferTabTitle,
  isDocsUrl,
  normalizeDocUrl,
  normalizeUrlByKind,
} from '@/shared/components/doc-browser/utils/doc-browser-url.utils';

export class DefaultDocBrowserRouteResolver implements DocBrowserRouteResolver {
  resolveOpenTarget = (params: {
    activeTab?: DocBrowserTab;
    kind?: DocBrowserTabKind;
    url?: string;
  }): DocBrowserRouteTarget => {
    const { activeTab, kind, url: requestedUrl } = params;
    const targetKind = kind
      ?? (requestedUrl ? undefined : activeTab?.kind)
      ?? (requestedUrl && isDocsUrl(requestedUrl) ? 'docs' : 'content');
    const rawUrl = requestedUrl?.trim()
      || (!kind && activeTab && activeTab.kind !== 'docs'
        ? activeTab.currentUrl
        : targetKind === DOC_BROWSER_HOME_TAB_KIND
          ? DOC_BROWSER_HOME_URL
          : targetKind === 'docs'
            ? getDefaultDocsUrl()
            : 'about:blank');
    const url = targetKind === 'docs' ? normalizeUrlByKind(rawUrl, 'docs') : rawUrl;
    return {
      historyPolicy: 'managed',
      kind: targetKind,
      title: targetKind === DOC_BROWSER_HOME_TAB_KIND
        ? 'Start Page'
        : inferTabTitle(url, targetKind, targetKind === 'docs' ? 'Docs' : 'Detail'),
      url,
    };
  };

  areUrlsEquivalent = (
    currentUrl: string,
    nextUrl: string,
    currentKind: DocBrowserTabKind,
    nextKind: DocBrowserTabKind,
  ): boolean => {
    if (currentKind !== nextKind) {
      return false;
    }
    return currentKind === 'docs'
      ? normalizeDocUrl(currentUrl) === normalizeDocUrl(nextUrl)
      : currentUrl === nextUrl;
  };

  usesManagedHistory = (tab: DocBrowserTab): boolean => {
    return tab.currentUrl !== DOCS_DEFAULT_BASE_URL;
  };
}

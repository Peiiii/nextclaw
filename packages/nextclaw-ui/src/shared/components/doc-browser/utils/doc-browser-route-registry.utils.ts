import type {
  DocBrowserOpenOptions,
  DocBrowserTab,
  DocBrowserTabKind,
} from '@/shared/components/doc-browser/types/doc-browser.types';
import { t } from '@/shared/lib/i18n';
import {
  DOCS_DEFAULT_BASE_URL,
  DOC_BROWSER_HOME_TAB_KIND,
  DOC_BROWSER_HOME_URL,
  getDefaultDocsUrl,
  inferTabTitle,
  isDocsUrl,
  normalizeDocUrl,
  normalizeUrlByKind,
} from './doc-browser-url.utils';

export const DOC_BROWSER_APPS_TAB_KIND = 'apps';
export const DOC_BROWSER_APPS_URL = 'nextclaw://apps';
export const DOC_BROWSER_SERVICE_APPS_URL = `${DOC_BROWSER_APPS_URL}?tab=service-apps`;

type DocBrowserHistoryPolicy = 'managed' | 'none';

type DocBrowserRouteDefinition = {
  defaultUrl: () => string;
  getDedupeKey?: (url: string) => string | undefined;
  getTitle: (url: string) => string;
  historyPolicy: DocBrowserHistoryPolicy;
  id: string;
  kind: DocBrowserTabKind;
  matchUrl: (url: string) => boolean;
  normalizeUrl: (url: string) => string;
  urlsEquivalent?: (currentUrl: string, nextUrl: string) => boolean;
};

type DocBrowserResolvedRoute = {
  dedupeKey?: string;
  historyPolicy: DocBrowserHistoryPolicy;
  kind: DocBrowserTabKind;
  title: string;
  url: string;
};

export type DocBrowserNavigationTarget =
  | {
    type: 'doc-browser';
    options?: DocBrowserOpenOptions;
    url?: string;
  }
  | {
    path: string;
    type: 'app-route';
  };

export type DocBrowserHomeNavigationItem = {
  id: string;
  label: string;
  target: DocBrowserNavigationTarget;
};

function isUrlWithPrefix(url: string, prefix: string): boolean {
  return url === prefix || url.startsWith(`${prefix}?`) || url.startsWith(`${prefix}/`);
}

function normalizeAppsUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const tab = parsed.searchParams.get('tab');
    return tab === 'service-apps' ? DOC_BROWSER_SERVICE_APPS_URL : DOC_BROWSER_APPS_URL;
  } catch {
    return DOC_BROWSER_APPS_URL;
  }
}

function inferFallbackKind(url?: string): DocBrowserTabKind {
  return url && isDocsUrl(url) ? 'docs' : 'content';
}

class FallbackDocBrowserRouteDefinition implements DocBrowserRouteDefinition {
  readonly historyPolicy = 'managed';

  readonly id: string;

  constructor(readonly kind: DocBrowserTabKind) {
    this.id = `fallback:${kind}`;
  }

  defaultUrl = (): string => this.kind === 'docs' ? DOCS_DEFAULT_BASE_URL : 'about:blank';

  getTitle = (url: string): string => inferTabTitle(url, this.kind, this.kind === 'docs' ? 'Docs' : 'Detail');

  matchUrl = (): boolean => false;

  normalizeUrl = (url: string): string => normalizeUrlByKind(url, this.kind);

  urlsEquivalent = (currentUrl: string, nextUrl: string): boolean => currentUrl === nextUrl;
}

const DOC_BROWSER_ROUTE_DEFINITIONS: DocBrowserRouteDefinition[] = [
  {
    defaultUrl: () => DOC_BROWSER_HOME_URL,
    getTitle: () => t('docBrowserHomeTitle'),
    historyPolicy: 'managed',
    id: 'home',
    kind: DOC_BROWSER_HOME_TAB_KIND,
    matchUrl: (url) => url === DOC_BROWSER_HOME_URL,
    normalizeUrl: () => DOC_BROWSER_HOME_URL,
    urlsEquivalent: (currentUrl, nextUrl) => currentUrl === nextUrl,
  },
  {
    defaultUrl: getDefaultDocsUrl,
    getTitle: () => 'Docs',
    historyPolicy: 'managed',
    id: 'docs',
    kind: 'docs',
    matchUrl: isDocsUrl,
    normalizeUrl: (url) => normalizeUrlByKind(url, 'docs'),
    urlsEquivalent: (currentUrl, nextUrl) => normalizeDocUrl(currentUrl) === normalizeDocUrl(nextUrl),
  },
  {
    defaultUrl: () => DOC_BROWSER_APPS_URL,
    getDedupeKey: () => 'apps',
    getTitle: (url) => normalizeAppsUrl(url) === DOC_BROWSER_SERVICE_APPS_URL
      ? t('serviceAppsTitle')
      : t('appsTitle'),
    historyPolicy: 'managed',
    id: 'apps',
    kind: DOC_BROWSER_APPS_TAB_KIND,
    matchUrl: (url) => isUrlWithPrefix(url, DOC_BROWSER_APPS_URL),
    normalizeUrl: normalizeAppsUrl,
    urlsEquivalent: (currentUrl, nextUrl) => normalizeAppsUrl(currentUrl) === normalizeAppsUrl(nextUrl),
  },
];

export class DocBrowserRouteRegistry {
  private readonly routeDefinitions = DOC_BROWSER_ROUTE_DEFINITIONS;

  resolveOpenTarget = (params: {
    activeTab?: DocBrowserTab;
    kind?: DocBrowserTabKind;
    url?: string;
  }): DocBrowserResolvedRoute => {
    const { activeTab, kind, url: requestedUrl } = params;
    const route = this.resolveRouteDefinition(requestedUrl, kind, activeTab);
    const rawUrl = requestedUrl?.trim()
      || (!kind && activeTab && activeTab.kind !== 'docs'
        ? activeTab.currentUrl
        : route.defaultUrl());
    const url = route.normalizeUrl(rawUrl);
    return {
      dedupeKey: route.getDedupeKey?.(url),
      historyPolicy: route.historyPolicy,
      kind: route.kind,
      title: route.getTitle(url),
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
    const route = this.resolveRouteDefinition(currentUrl, currentKind);
    return route.urlsEquivalent?.(currentUrl, nextUrl) ?? currentUrl === nextUrl;
  };

  usesManagedHistory = (tab: DocBrowserTab): boolean => {
    return this.resolveRouteDefinition(tab.currentUrl, tab.kind).historyPolicy === 'managed';
  };

  getHomeNavigationItems = (): DocBrowserHomeNavigationItem[] => [
    {
      id: 'apps',
      label: t('appsTitle'),
      target: { type: 'doc-browser', url: DOC_BROWSER_APPS_URL },
    },
    {
      id: 'service-apps',
      label: t('serviceAppsTitle'),
      target: { type: 'doc-browser', url: DOC_BROWSER_SERVICE_APPS_URL },
    },
    {
      id: 'docs',
      label: t('docBrowserHelp'),
      target: {
        options: { newTab: true },
        type: 'doc-browser',
        url: getDefaultDocsUrl(),
      },
    },
    {
      id: 'skill-marketplace',
      label: t('marketplaceSkillsPageTitle'),
      target: { path: '/marketplace/skills', type: 'app-route' },
    },
    {
      id: 'mcp-marketplace',
      label: t('marketplaceMcpPageTitle'),
      target: { path: '/marketplace/mcp', type: 'app-route' },
    },
  ];

  private resolveRouteDefinition = (
    url?: string,
    kind?: DocBrowserTabKind,
    activeTab?: DocBrowserTab,
  ): DocBrowserRouteDefinition => {
    const targetKind = kind ?? (url ? undefined : activeTab?.kind);
    const routeByKind = targetKind
      ? this.routeDefinitions.find((route) => route.kind === targetKind)
      : undefined;
    if (routeByKind) {
      return routeByKind;
    }

    const routeByUrl = url
      ? this.routeDefinitions.find((route) => route.matchUrl(url))
      : undefined;
    if (routeByUrl) {
      return routeByUrl;
    }

    return new FallbackDocBrowserRouteDefinition(kind ?? activeTab?.kind ?? inferFallbackKind(url));
  };
}

export const docBrowserRouteRegistry = new DocBrowserRouteRegistry();

import type {
  DocBrowserRouteResolver,
  DocBrowserTab,
  DocBrowserTabKind,
} from '@/shared/components/doc-browser/types/doc-browser.types';
import { isDocsUrl } from '@/shared/components/doc-browser/utils/doc-browser-url.utils';
import { ResourceUriResolver, parseResourceUri } from '@/shared/lib/resource-uri';
import {
  RIGHT_PANEL_RESOURCE_ROUTE_DEFINITIONS,
  RIGHT_PANEL_RESOURCE_ROUTE_DEFINITIONS_FOR_RESOURCE_URI,
} from '@/features/right-panel-resources/configs/right-panel-resource-routes.config';
import type {
  RightPanelResourceRouteDefinition,
  RightPanelResourceTarget,
} from '@/features/right-panel-resources/types/right-panel-resource.types';

function inferFallbackKind(url?: string): DocBrowserTabKind {
  return url && isDocsUrl(url) ? 'docs' : 'content';
}

export class RightPanelResourceRouteResolver implements DocBrowserRouteResolver {
  private readonly resourceUriResolver = new ResourceUriResolver<RightPanelResourceTarget>(
    RIGHT_PANEL_RESOURCE_ROUTE_DEFINITIONS_FOR_RESOURCE_URI,
    { getNormalizedUri: (target) => target.url },
  );

  resolve = (uri: string): RightPanelResourceTarget => this.resourceUriResolver.resolve(uri);

  normalize = (uri: string): string => this.resourceUriResolver.normalize(uri);

  areEquivalent = (left: string, right: string): boolean => this.resourceUriResolver.areEquivalent(left, right);

  resolveOpenTarget = (params: {
    activeTab?: DocBrowserTab;
    kind?: DocBrowserTabKind;
    url?: string;
  }): RightPanelResourceTarget => {
    const { activeTab, kind, url: requestedUrl } = params;
    const route = this.resolveRouteDefinition(requestedUrl, kind, activeTab);
    const rawUrl = requestedUrl?.trim()
      || (!kind && activeTab && activeTab.kind !== 'docs'
        ? activeTab.currentUrl
        : route.defaultUrl());
    return route.resolve(parseResourceUri(rawUrl));
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
    return route.areEquivalent?.(currentUrl, nextUrl) ?? this.areEquivalent(currentUrl, nextUrl);
  };

  usesManagedHistory = (tab: DocBrowserTab): boolean => {
    return this.resolveRouteDefinition(tab.currentUrl, tab.kind).resolve(parseResourceUri(tab.currentUrl)).historyPolicy === 'managed';
  };

  private resolveRouteDefinition = (
    url?: string,
    kind?: DocBrowserTabKind,
    activeTab?: DocBrowserTab,
  ): RightPanelResourceRouteDefinition => {
    const targetKind = kind ?? (url ? undefined : activeTab?.kind);
    const routeByKind = targetKind
      ? RIGHT_PANEL_RESOURCE_ROUTE_DEFINITIONS.find((route) => route.kind === targetKind)
      : undefined;
    if (routeByKind) {
      return routeByKind;
    }

    const parsed = url ? parseResourceUri(url) : null;
    const routeByUrl = parsed
      ? RIGHT_PANEL_RESOURCE_ROUTE_DEFINITIONS.find((route) => route.match(parsed))
      : undefined;
    if (routeByUrl) {
      return routeByUrl;
    }

    const fallbackKind = kind ?? activeTab?.kind ?? inferFallbackKind(url);
    return RIGHT_PANEL_RESOURCE_ROUTE_DEFINITIONS.find((route) => route.kind === fallbackKind)
      ?? RIGHT_PANEL_RESOURCE_ROUTE_DEFINITIONS[RIGHT_PANEL_RESOURCE_ROUTE_DEFINITIONS.length - 1];
  };
}

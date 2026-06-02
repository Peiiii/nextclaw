import { t } from '@/shared/lib/i18n';
import type { ParsedResourceUri, ResourceUriRouteDefinition } from '@/shared/lib/resource-uri';
import {
  getDefaultDocsUrl,
  inferTabTitle,
  isDocsUrl,
  normalizeDocUrl,
  normalizeUrlByKind,
} from '@/shared/components/doc-browser/utils/doc-browser-url.utils';
import type {
  RightPanelResourceHomeNavigationItem,
  RightPanelResourceRouteDefinition,
  RightPanelResourceTarget,
} from '@/features/right-panel-resources/types/right-panel-resource.types';
import {
  RIGHT_PANEL_APPS_URL,
  RIGHT_PANEL_APPS_TAB_KIND,
  RIGHT_PANEL_HOME_TAB_KIND,
  RIGHT_PANEL_HOME_URL,
  RIGHT_PANEL_PANEL_APP_TAB_KIND,
  RIGHT_PANEL_SERVICE_APPS_URL,
  normalizeRightPanelAppsUrl,
} from '@/features/right-panel-resources/utils/right-panel-resource-uri.utils';

function isUrlWithPrefix(url: string, prefix: string): boolean {
  return url === prefix || url.startsWith(`${prefix}?`) || url.startsWith(`${prefix}/`);
}

function resolveNextclawDocsUrl(uri: ParsedResourceUri): string {
  const docsPath = uri.pathSegments.join('/');
  const rawPath = docsPath ? `/${docsPath}` : '/';
  return normalizeUrlByKind(rawPath, 'docs');
}

function resolvePanelAppPlaceholderUrl(uri: ParsedResourceUri): string {
  const appId = uri.pathSegments[0] ?? '';
  return appId ? `nextclaw://panel-app/${encodeURIComponent(appId)}` : 'nextclaw://panel-app';
}

export const RIGHT_PANEL_RESOURCE_ROUTE_DEFINITIONS: RightPanelResourceRouteDefinition[] = [
  {
    defaultUrl: () => RIGHT_PANEL_HOME_URL,
    id: 'home',
    kind: RIGHT_PANEL_HOME_TAB_KIND,
    match: (uri) => uri.raw === RIGHT_PANEL_HOME_URL,
    resolve: () => ({
      historyPolicy: 'managed',
      kind: RIGHT_PANEL_HOME_TAB_KIND,
      title: t('docBrowserHomeTitle'),
      url: RIGHT_PANEL_HOME_URL,
    }),
    areEquivalent: (left, right) => left === right,
  },
  {
    defaultUrl: getDefaultDocsUrl,
    id: 'docs-url',
    kind: 'docs',
    match: (uri) => isDocsUrl(uri.raw),
    resolve: (uri) => {
      const url = normalizeUrlByKind(uri.raw, 'docs');
      return {
        historyPolicy: 'managed',
        kind: 'docs',
        title: t('docBrowserHelp'),
        url,
      };
    },
    areEquivalent: (left, right) => normalizeDocUrl(left) === normalizeDocUrl(right),
  },
  {
    defaultUrl: getDefaultDocsUrl,
    id: 'nextclaw-docs',
    kind: 'docs',
    match: (uri) => uri.scheme === 'nextclaw' && uri.authority === 'docs',
    resolve: (uri) => {
      const url = resolveNextclawDocsUrl(uri);
      return {
        historyPolicy: 'managed',
        kind: 'docs',
        title: t('docBrowserHelp'),
        url,
      };
    },
    areEquivalent: (left, right) => normalizeDocUrl(left) === normalizeDocUrl(right),
  },
  {
    defaultUrl: () => RIGHT_PANEL_APPS_URL,
    id: 'apps',
    kind: RIGHT_PANEL_APPS_TAB_KIND,
    match: (uri) => isUrlWithPrefix(uri.raw, RIGHT_PANEL_APPS_URL),
    resolve: (uri) => {
      const url = normalizeRightPanelAppsUrl(uri.raw);
      return {
        dedupeKey: 'apps',
        historyPolicy: 'managed',
        kind: RIGHT_PANEL_APPS_TAB_KIND,
        title: url === RIGHT_PANEL_APPS_URL ? t('appsTitle') : t('serviceAppsTitle'),
        url,
      };
    },
    areEquivalent: (left, right) => normalizeRightPanelAppsUrl(left) === normalizeRightPanelAppsUrl(right),
  },
  {
    defaultUrl: () => 'nextclaw://panel-app',
    id: 'panel-app',
    kind: RIGHT_PANEL_PANEL_APP_TAB_KIND,
    match: (uri) => uri.scheme === 'nextclaw' && uri.authority === 'panel-app',
    resolve: (uri) => {
      const url = resolvePanelAppPlaceholderUrl(uri);
      const appId = uri.pathSegments[0] ?? '';
      return {
        dedupeKey: appId ? `panel-app:${decodeURIComponent(appId)}` : undefined,
        historyPolicy: 'managed',
        kind: RIGHT_PANEL_PANEL_APP_TAB_KIND,
        title: t('panelAppsTitle'),
        url,
      };
    },
    areEquivalent: (left, right) => left === right,
  },
  {
    defaultUrl: () => 'about:blank',
    id: 'content',
    kind: 'content',
    match: () => true,
    resolve: (uri) => ({
      historyPolicy: 'managed',
      kind: 'content',
      title: inferTabTitle(uri.raw, 'content', 'Detail'),
      url: uri.raw || 'about:blank',
    }),
    areEquivalent: (left, right) => left === right,
  },
];

export const RIGHT_PANEL_RESOURCE_ROUTE_DEFINITIONS_FOR_RESOURCE_URI: ResourceUriRouteDefinition<RightPanelResourceTarget>[] =
  RIGHT_PANEL_RESOURCE_ROUTE_DEFINITIONS.map((definition) => ({
    areEquivalent: definition.areEquivalent,
    id: definition.id,
    match: definition.match,
    resolve: definition.resolve,
  }));

export function getRightPanelResourceHomeNavigationItems(): RightPanelResourceHomeNavigationItem[] {
  return [
    {
      id: 'apps',
      label: t('appsTitle'),
      target: { type: 'right-panel-resource', uri: RIGHT_PANEL_APPS_URL },
    },
    {
      id: 'service-apps',
      label: t('serviceAppsTitle'),
      target: { type: 'right-panel-resource', uri: RIGHT_PANEL_SERVICE_APPS_URL },
    },
    {
      id: 'docs',
      label: t('docBrowserHelp'),
      target: {
        options: { newTab: true },
        type: 'right-panel-resource',
        uri: getDefaultDocsUrl(),
      },
    },
    {
      id: 'skill-marketplace',
      label: t('marketplaceSkillsPageTitle'),
      target: { path: '/marketplace/skills', type: 'app-route' },
    },
  ];
}

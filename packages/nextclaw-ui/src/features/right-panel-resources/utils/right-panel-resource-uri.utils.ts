import {
  readChatUiResourceReference,
  type ChatUiResourceReference,
} from '@nextclaw/shared';
import type { PanelAppEntryView } from '@/shared/lib/api';
import type { DocBrowserDockIcon } from '@/shared/components/doc-browser';
import type { DocBrowserTab } from '@/shared/components/doc-browser/doc-browser-context';
import type { RightPanelResourceTarget } from '@/features/right-panel-resources/types/right-panel-resource.types';
import { parseResourceUri, type ParsedResourceUri } from '@/shared/lib/resource-uri';

export const RIGHT_PANEL_HOME_TAB_KIND = 'home';
export const RIGHT_PANEL_HOME_URL = 'nextclaw://new-tab';
export const RIGHT_PANEL_APPS_TAB_KIND = 'apps';
export const RIGHT_PANEL_APPS_URL = 'nextclaw://apps';
export const RIGHT_PANEL_PANEL_APPS_URL = `${RIGHT_PANEL_APPS_URL}?tab=panel-apps`;
export const RIGHT_PANEL_SERVICE_APPS_URL = `${RIGHT_PANEL_APPS_URL}?tab=service-apps`;
export const RIGHT_PANEL_PANEL_APP_TAB_KIND = 'panel-app';

const NON_REFERENCEABLE_RESOURCE_URIS = new Set([
  RIGHT_PANEL_HOME_URL,
  'about:blank',
]);

export function createChatUiResourceReferenceFromTab(
  tab: DocBrowserTab,
): ChatUiResourceReference | null {
  const uri = tab.resourceUri?.trim() || tab.currentUrl.trim();
  const currentUrl = tab.currentUrl.trim();
  if (!uri || !currentUrl || NON_REFERENCEABLE_RESOURCE_URIS.has(uri)) {
    return null;
  }
  return readChatUiResourceReference({
    uri,
    resourceKind: tab.kind,
    title: tab.title.trim() || uri,
    currentUrl,
    ...(tab.contentParams
      ? { contentParams: structuredClone(tab.contentParams) }
      : {}),
  });
}

export type RightPanelAppsTab = 'apps' | 'panel-apps' | 'service-apps';

const DEFAULT_RIGHT_PANEL_APPS_TAB: RightPanelAppsTab = 'apps';

function isRightPanelAppsTab(value: unknown): value is RightPanelAppsTab {
  return value === 'apps' || value === 'panel-apps' || value === 'service-apps';
}

export function createRightPanelAppsUrl(tab: RightPanelAppsTab = DEFAULT_RIGHT_PANEL_APPS_TAB): string {
  if (tab === 'panel-apps') return RIGHT_PANEL_PANEL_APPS_URL;
  if (tab === 'service-apps') return RIGHT_PANEL_SERVICE_APPS_URL;
  return RIGHT_PANEL_APPS_URL;
}

export function getRightPanelAppsTabFromUrl(url: string): RightPanelAppsTab {
  try {
    const tab = new URL(url).searchParams.get('tab');
    return isRightPanelAppsTab(tab) ? tab : DEFAULT_RIGHT_PANEL_APPS_TAB;
  } catch {
    return DEFAULT_RIGHT_PANEL_APPS_TAB;
  }
}

export function normalizeRightPanelAppsUrl(url: string): string {
  return createRightPanelAppsUrl(getRightPanelAppsTabFromUrl(url));
}

export function createPanelAppResourceUri(appId: string, sourcePath?: string): string {
  const uri = `nextclaw://panel-app/${encodeURIComponent(appId)}`;
  const path = sourcePath?.trim();
  return path ? `${uri}?${new URLSearchParams({ path }).toString()}` : uri;
}

export function createPanelAppContentPath(appId: string, sourcePath?: string): string {
  const url = `/api/panel-apps/${encodeURIComponent(appId)}/content`;
  const path = sourcePath?.trim();
  return path ? `${url}?${new URLSearchParams({ path }).toString()}` : url;
}

export function readPanelAppIdFromParsedResourceUri(uri: ParsedResourceUri): string | null {
  const encodedAppId = uri.scheme === 'nextclaw' && uri.authority === 'panel-app'
    ? uri.pathSegments[0]
    : (() => {
        const [apiSegment, collectionSegment, appId, contentSegment] = uri.pathSegments;
        return apiSegment === 'api'
          && collectionSegment === 'panel-apps'
          && contentSegment === 'content'
          ? appId
          : undefined;
      })();
  if (!encodedAppId) {
    return null;
  }
  try {
    return decodeURIComponent(encodedAppId);
  } catch {
    return null;
  }
}

export function readPanelAppIdFromResourceUri(value: string): string | null {
  const uri = parseResourceUri(value);
  return uri.searchParams.has('path')
    ? null
    : readPanelAppIdFromParsedResourceUri(uri);
}

export function readPanelAppIdFromTab(
  tab: Pick<DocBrowserTab, 'currentUrl' | 'resourceUri'>,
): string | null {
  return (tab.resourceUri
    ? readPanelAppIdFromResourceUri(tab.resourceUri)
    : null) ?? readPanelAppIdFromResourceUri(tab.currentUrl);
}

function isPanelAppImageIcon(icon: string): boolean {
  return (
    icon.startsWith('data:image/') ||
    icon.startsWith('http://') ||
    icon.startsWith('https://') ||
    icon.startsWith('/')
  );
}

function createPanelAppDockIcon(entry: PanelAppEntryView): DocBrowserDockIcon | undefined {
  const icon = entry.icon?.trim();
  if (!icon) {
    return undefined;
  }
  return isPanelAppImageIcon(icon)
    ? { type: 'url', url: icon }
    : { type: 'text', value: icon };
}

export function createPanelAppRightPanelResourceTarget(entry: PanelAppEntryView): RightPanelResourceTarget {
  return {
    dedupeKey: `panel-app:${entry.appId}`,
    dockIcon: createPanelAppDockIcon(entry),
    historyPolicy: 'managed',
    kind: RIGHT_PANEL_PANEL_APP_TAB_KIND,
    resourceUri: createPanelAppResourceUri(entry.appId),
    title: entry.title,
    url: entry.contentPath,
  };
}

import type { PanelAppEntryView } from '@/shared/lib/api';
import type { DocBrowserDockIcon } from '@/shared/components/doc-browser';
import type { RightPanelResourceTarget } from '@/features/right-panel-resources/types/right-panel-resource.types';

export const RIGHT_PANEL_HOME_TAB_KIND = 'home';
export const RIGHT_PANEL_HOME_URL = 'nextclaw://new-tab';
export const RIGHT_PANEL_APPS_TAB_KIND = 'apps';
export const RIGHT_PANEL_APPS_URL = 'nextclaw://apps';
export const RIGHT_PANEL_SERVICE_APPS_URL = `${RIGHT_PANEL_APPS_URL}?tab=service-apps`;
export const RIGHT_PANEL_PANEL_APP_TAB_KIND = 'panel-app';

export type RightPanelAppsTab = 'panel-apps' | 'service-apps';

const DEFAULT_RIGHT_PANEL_APPS_TAB: RightPanelAppsTab = 'panel-apps';

function isRightPanelAppsTab(value: unknown): value is RightPanelAppsTab {
  return value === 'panel-apps' || value === 'service-apps';
}

export function createRightPanelAppsUrl(tab: RightPanelAppsTab = DEFAULT_RIGHT_PANEL_APPS_TAB): string {
  return tab === DEFAULT_RIGHT_PANEL_APPS_TAB ? RIGHT_PANEL_APPS_URL : RIGHT_PANEL_SERVICE_APPS_URL;
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

export function createPanelAppResourceUri(appId: string): string {
  return `nextclaw://panel-app/${encodeURIComponent(appId)}`;
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
    dedupeKey: `panel-app:${entry.id}`,
    dockIcon: createPanelAppDockIcon(entry),
    historyPolicy: 'managed',
    kind: RIGHT_PANEL_PANEL_APP_TAB_KIND,
    resourceUri: createPanelAppResourceUri(entry.id),
    title: entry.title,
    url: entry.contentPath,
  };
}

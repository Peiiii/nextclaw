import type { PanelAppEntryView } from '@/shared/lib/api';
import type { RightPanelResourceTarget } from '@/features/right-panel-resources/types/right-panel-resource.types';

export const RIGHT_PANEL_HOME_TAB_KIND = 'home';
export const RIGHT_PANEL_HOME_URL = 'nextclaw://new-tab';
export const RIGHT_PANEL_APPS_TAB_KIND = 'apps';
export const RIGHT_PANEL_APPS_URL = 'nextclaw://apps';
export const RIGHT_PANEL_SERVICE_APPS_URL = `${RIGHT_PANEL_APPS_URL}?tab=service-apps`;
export const RIGHT_PANEL_PANEL_APP_TAB_KIND = 'panel-app';

export function createPanelAppResourceUri(appId: string): string {
  return `nextclaw://panel-app/${encodeURIComponent(appId)}`;
}

export function createPanelAppRightPanelResourceTarget(entry: PanelAppEntryView): RightPanelResourceTarget {
  return {
    dedupeKey: `panel-app:${entry.id}`,
    historyPolicy: 'managed',
    kind: RIGHT_PANEL_PANEL_APP_TAB_KIND,
    title: entry.title,
    url: entry.contentPath,
  };
}

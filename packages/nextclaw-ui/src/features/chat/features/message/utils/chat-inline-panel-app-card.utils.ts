import {
  createPanelAppResourceUri,
  RIGHT_PANEL_PANEL_APP_TAB_KIND,
} from '@/features/right-panel-resources';
import type { DocBrowserTab } from '@/shared/components/doc-browser/doc-browser-context';

export const PANEL_APP_INLINE_IFRAME_SANDBOX = [
  'allow-scripts',
  'allow-forms',
  'allow-modals',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-downloads',
  'allow-pointer-lock',
  'allow-presentation',
].join(' ');

export function createFallbackPanelAppContentPath(appId: string): string {
  return `/api/panel-apps/${encodeURIComponent(appId)}/content`;
}

export function createInlinePanelAppTab(params: {
  appId: string;
  title: string;
  url: string;
}): DocBrowserTab {
  const { appId, title, url } = params;
  return {
    currentUrl: url,
    dedupeKey: `panel-app:${appId}`,
    history: [url],
    historyIndex: 0,
    id: `inline-panel-app:${appId}`,
    kind: RIGHT_PANEL_PANEL_APP_TAB_KIND,
    navVersion: 0,
    resourceUri: createPanelAppResourceUri(appId),
    title,
  };
}

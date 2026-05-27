import { AppWindow, Server } from 'lucide-react';
import type { DocBrowserContextValue } from '@/shared/components/doc-browser/doc-browser-context';
import type { DocBrowserCustomTabRenderers } from '@/shared/components/doc-browser/doc-browser-renderer.types';
import { PanelAppToolbar } from '@/features/panel-apps/components/panel-app-toolbar';
import { PanelAppsList } from '@/features/panel-apps/components/panel-apps-list';
import { panelAppBridgeManager } from '@/features/panel-apps/managers/panel-app-bridge.manager';
import { ServiceAppsPanel } from '@/features/service-apps';
import { t } from '@/shared/lib/i18n';

export const PANEL_APPS_LIST_TAB_KIND = 'panel-apps';
export const PANEL_APP_TAB_KIND = 'panel-app';
export const SERVICE_APPS_TAB_KIND = 'service-apps';
const PANEL_APPS_LIST_URL = 'nextclaw://panel-apps';
const SERVICE_APPS_URL = 'nextclaw://service-apps';
const PANEL_APP_IFRAME_SANDBOX = [
  'allow-scripts',
  'allow-forms',
  'allow-modals',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-downloads',
  'allow-pointer-lock',
  'allow-presentation',
].join(' ');

export function openPanelApps(docBrowser: Pick<DocBrowserContextValue, 'open'>): void {
  docBrowser.open(PANEL_APPS_LIST_URL, {
    kind: PANEL_APPS_LIST_TAB_KIND,
    title: t('panelAppsTitle'),
    dedupeKey: 'panel-apps:list',
  });
}

export function openServiceApps(docBrowser: Pick<DocBrowserContextValue, 'open'>): void {
  docBrowser.open(SERVICE_APPS_URL, {
    kind: SERVICE_APPS_TAB_KIND,
    title: t('serviceAppsTitle'),
    dedupeKey: 'service-apps:list',
  });
}

export const PANEL_APPS_DOC_BROWSER_RENDERERS: DocBrowserCustomTabRenderers = {
  [PANEL_APPS_LIST_TAB_KIND]: {
    getTitle: () => t('panelAppsTitle'),
    renderIcon: () => <AppWindow className="w-4 h-4 text-primary shrink-0" />,
    renderContent: ({ open }) => (
      <PanelAppsList
        onOpenServiceApps={() => openServiceApps({ open })}
        onOpenPanelApp={(entry) => open(entry.contentPath, {
          kind: PANEL_APP_TAB_KIND,
          title: entry.title,
          dedupeKey: `panel-app:${entry.id}`,
        })}
      />
    ),
  },
  [SERVICE_APPS_TAB_KIND]: {
    getTitle: () => t('serviceAppsTitle'),
    renderIcon: () => <Server className="w-4 h-4 text-primary shrink-0" />,
    renderContent: () => <ServiceAppsPanel />,
  },
  [PANEL_APP_TAB_KIND]: {
    getIframeSandbox: () => PANEL_APP_IFRAME_SANDBOX,
    getTitle: (tab) => tab.title || t('panelAppsTitle'),
    onIframeMessage: panelAppBridgeManager.handleIframeMessage,
    renderIcon: () => <AppWindow className="w-4 h-4 text-primary shrink-0" />,
    renderToolbar: ({ open, refreshIframe }) => (
      <PanelAppToolbar
        onOpenPanelApps={() => openPanelApps({ open })}
        onRefresh={refreshIframe}
      />
    ),
  },
};

import { AppWindow, Boxes, ExternalLink, RefreshCw } from 'lucide-react';
import type { DocBrowserContextValue } from '@/shared/components/doc-browser/doc-browser-context';
import type { DocBrowserCustomTabRenderers } from '@/shared/components/doc-browser/doc-browser-renderer.types';
import { getPresenter } from '@/app/presenters/app.presenter';
import { AppsPanel } from '@/features/apps';
import {
  createPanelAppRightPanelResourceTarget,
  RIGHT_PANEL_APPS_TAB_KIND,
  createRightPanelAppsUrl,
  getRightPanelAppsTabFromUrl,
  RIGHT_PANEL_HOME_TAB_KIND,
  RIGHT_PANEL_PANEL_APP_TAB_KIND,
  RightPanelResourceHomePage,
  readPanelAppIdFromTab,
} from '@/features/right-panel-resources';
import { t } from '@/shared/lib/i18n';
import { PANEL_APP_IFRAME_SANDBOX, focusPanelAppIframe } from './panel-app-iframe.utils';

export const APPS_TAB_KIND = RIGHT_PANEL_APPS_TAB_KIND;
export const PANEL_APP_TAB_KIND = RIGHT_PANEL_PANEL_APP_TAB_KIND;
export const createAppsPanelUrl = createRightPanelAppsUrl;
export const getAppsPanelTabFromUrl = getRightPanelAppsTabFromUrl;

export function openApps(docBrowser: Pick<DocBrowserContextValue, 'open'>): void {
  docBrowser.open(createAppsPanelUrl(), {
    kind: APPS_TAB_KIND,
    title: t('appsTitle'),
    dedupeKey: 'apps',
  });
}

export const PANEL_APPS_DOC_BROWSER_RENDERERS: DocBrowserCustomTabRenderers = {
  [RIGHT_PANEL_HOME_TAB_KIND]: {
    getTitle: () => t('docBrowserHomeTitle'),
    renderContent: ({ open }) => <RightPanelResourceHomePage open={open} />,
  },
  [APPS_TAB_KIND]: {
    getTitle: () => t('appsTitle'),
    renderIcon: () => <Boxes className="w-4 h-4 text-primary shrink-0" />,
    renderContent: ({ currentUrl, open, openTarget }) => (
      <AppsPanel
        activeTab={getAppsPanelTabFromUrl(currentUrl)}
        onActiveTabChange={(tab) => open(createAppsPanelUrl(tab), {
          activate: false,
          kind: APPS_TAB_KIND,
          title: t('appsTitle'),
          dedupeKey: 'apps',
        })}
        onOpenPanelApp={(entry) => openTarget(createPanelAppRightPanelResourceTarget(entry))}
      />
    ),
  },
  [PANEL_APP_TAB_KIND]: {
    getIframeSandbox: () => PANEL_APP_IFRAME_SANDBOX,
    getTitle: (tab) => tab.title || t('panelAppsTitle'),
    onIframeMessage: (params) => getPresenter().panelAppBridgeManager.handleIframeMessage(params),
    onIframePointerOver: (event) => focusPanelAppIframe(event.currentTarget),
    renderIcon: () => <AppWindow className="w-4 h-4 text-primary shrink-0" />,
    getTabMenuGroups: ({ refreshIframe, tab }) => {
      const appId = readPanelAppIdFromTab(tab);
      return [{
        key: 'panel-app-actions',
        items: [
          {
            key: 'refresh',
            icon: <RefreshCw className="h-4 w-4" />,
            label: t('panelAppsRefreshCurrent'),
            onSelect: refreshIframe,
          },
          ...(appId ? [{
            key: 'open-standalone',
            icon: <ExternalLink className="h-4 w-4" />,
            label: t(typeof window !== 'undefined' && window.nextclawDesktop ? 'panelAppsOpenInBrowser' : 'panelAppsOpenInNewTab'),
            href: `/apps/panel/${encodeURIComponent(appId)}/standalone`,
            target: '_blank' as const,
            rel: 'opener',
            referrerPolicy: 'no-referrer' as const,
          }] : []),
        ],
      }];
    },
    supportsScrollRestoration: true,
  },
};

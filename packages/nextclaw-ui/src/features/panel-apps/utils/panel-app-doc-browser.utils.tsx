import { AppWindow, Boxes } from 'lucide-react';
import type { DocBrowserContextValue } from '@/shared/components/doc-browser/doc-browser-context';
import type { DocBrowserCustomTabRenderers } from '@/shared/components/doc-browser/doc-browser-renderer.types';
import { getPresenter } from '@/app/presenters/app.presenter';
import { AppsPanel } from '@/features/apps';
import { PanelAppDocBrowserToolbar } from '@/features/panel-apps/components/panel-app-toolbar';
import {
  createPanelAppRightPanelResourceTarget,
  RIGHT_PANEL_APPS_TAB_KIND,
  createRightPanelAppsUrl,
  getRightPanelAppsTabFromUrl,
  RIGHT_PANEL_HOME_TAB_KIND,
  RIGHT_PANEL_PANEL_APP_TAB_KIND,
  RightPanelResourceHomePage,
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
    renderToolbar: ({ refreshIframe, tab }) => (
      <PanelAppDocBrowserToolbar
        appTitle={tab.title || t('panelAppsTitle')}
        currentUrl={tab.currentUrl}
        onRefresh={refreshIframe}
        resourceUri={tab.resourceUri}
      />
    ),
    supportsScrollRestoration: true,
  },
};

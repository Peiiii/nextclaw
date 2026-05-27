import { AppWindow, Boxes } from 'lucide-react';
import type { DocBrowserContextValue } from '@/shared/components/doc-browser/doc-browser-context';
import type { DocBrowserCustomTabRenderers } from '@/shared/components/doc-browser/doc-browser-renderer.types';
import { getPresenter } from '@/app/presenters/app.presenter';
import { AppsPanel, type AppsPanelTab } from '@/features/apps';
import { PanelAppToolbar } from '@/features/panel-apps/components/panel-app-toolbar';
import { t } from '@/shared/lib/i18n';

export const APPS_TAB_KIND = 'apps';
export const PANEL_APP_TAB_KIND = 'panel-app';
const APPS_URL = 'nextclaw://apps';
const DEFAULT_APPS_PANEL_TAB: AppsPanelTab = 'panel-apps';
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

function isAppsPanelTab(value: unknown): value is AppsPanelTab {
  return value === 'panel-apps' || value === 'service-apps';
}

export function createAppsPanelUrl(tab: AppsPanelTab = DEFAULT_APPS_PANEL_TAB): string {
  return tab === DEFAULT_APPS_PANEL_TAB ? APPS_URL : `${APPS_URL}?tab=${tab}`;
}

export function getAppsPanelTabFromUrl(url: string): AppsPanelTab {
  try {
    const tab = new URL(url).searchParams.get('tab');
    return isAppsPanelTab(tab) ? tab : DEFAULT_APPS_PANEL_TAB;
  } catch {
    return DEFAULT_APPS_PANEL_TAB;
  }
}

export function openApps(docBrowser: Pick<DocBrowserContextValue, 'open'>): void {
  docBrowser.open(createAppsPanelUrl(), {
    kind: APPS_TAB_KIND,
    title: t('appsTitle'),
    dedupeKey: 'apps',
  });
}

export const PANEL_APPS_DOC_BROWSER_RENDERERS: DocBrowserCustomTabRenderers = {
  [APPS_TAB_KIND]: {
    getTitle: () => t('appsTitle'),
    renderIcon: () => <Boxes className="w-4 h-4 text-primary shrink-0" />,
    renderContent: ({ currentUrl, open }) => (
      <AppsPanel
        activeTab={getAppsPanelTabFromUrl(currentUrl)}
        onActiveTabChange={(tab) => open(createAppsPanelUrl(tab), {
          activate: false,
          kind: APPS_TAB_KIND,
          title: t('appsTitle'),
          dedupeKey: 'apps',
        })}
        onOpenPanelApp={(entry) => open(entry.contentPath, {
          kind: PANEL_APP_TAB_KIND,
          title: entry.title,
          dedupeKey: `panel-app:${entry.id}`,
        })}
      />
    ),
  },
  [PANEL_APP_TAB_KIND]: {
    getIframeSandbox: () => PANEL_APP_IFRAME_SANDBOX,
    getTitle: (tab) => tab.title || t('panelAppsTitle'),
    onIframeMessage: (params) => getPresenter().panelAppBridgeManager.handleIframeMessage(params),
    renderIcon: () => <AppWindow className="w-4 h-4 text-primary shrink-0" />,
    renderToolbar: ({ open, refreshIframe }) => (
      <PanelAppToolbar
        onOpenApps={() => openApps({ open })}
        onRefresh={refreshIframe}
      />
    ),
  },
};

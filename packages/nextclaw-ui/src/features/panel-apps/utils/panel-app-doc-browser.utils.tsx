import { AppWindow } from 'lucide-react';
import type { DocBrowserContextValue } from '@/shared/components/doc-browser/doc-browser-context';
import type { DocBrowserCustomTabRenderers } from '@/shared/components/doc-browser/doc-browser-renderer.types';
import { PanelAppToolbar } from '@/features/panel-apps/components/panel-app-toolbar';
import { PanelAppsList } from '@/features/panel-apps/components/panel-apps-list';
import { t } from '@/shared/lib/i18n';

export const PANEL_APPS_LIST_TAB_KIND = 'panel-apps';
export const PANEL_APP_TAB_KIND = 'panel-app';
const PANEL_APPS_LIST_URL = 'nextclaw://panel-apps';

export function openPanelApps(docBrowser: Pick<DocBrowserContextValue, 'open'>): void {
  docBrowser.open(PANEL_APPS_LIST_URL, {
    kind: PANEL_APPS_LIST_TAB_KIND,
    title: t('panelAppsTitle'),
    dedupeKey: 'panel-apps:list',
  });
}

export const PANEL_APPS_DOC_BROWSER_RENDERERS: DocBrowserCustomTabRenderers = {
  [PANEL_APPS_LIST_TAB_KIND]: {
    getTitle: () => t('panelAppsTitle'),
    renderIcon: () => <AppWindow className="w-4 h-4 text-primary shrink-0" />,
    renderContent: ({ open }) => (
      <PanelAppsList
        onOpenPanelApp={(entry) => open(entry.contentPath, {
          kind: PANEL_APP_TAB_KIND,
          title: entry.title,
          dedupeKey: `panel-app:${entry.id}`,
        })}
      />
    ),
  },
  [PANEL_APP_TAB_KIND]: {
    getIframeSandbox: () => 'allow-scripts allow-forms',
    getTitle: (tab) => tab.title || t('panelAppsTitle'),
    renderIcon: () => <AppWindow className="w-4 h-4 text-primary shrink-0" />,
    renderToolbar: ({ open, refreshIframe }) => (
      <PanelAppToolbar
        onOpenPanelApps={() => openPanelApps({ open })}
        onRefresh={refreshIframe}
      />
    ),
  },
};

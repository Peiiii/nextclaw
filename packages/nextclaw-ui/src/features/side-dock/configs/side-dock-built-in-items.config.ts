import {
  RIGHT_PANEL_APPS_URL,
  RIGHT_PANEL_HOME_URL,
  RIGHT_PANEL_SERVICE_APPS_URL,
} from '@/features/right-panel-resources';
import type { SideDockItem } from '@/features/side-dock/types/side-dock.types';
import { t } from '@/shared/lib/i18n';

export const SIDE_DOCK_DOCS_URL = 'nextclaw://docs';

export function getSideDockBuiltInItems(): SideDockItem[] {
  return [
    {
      builtIn: true,
      icon: { type: 'builtin', name: 'apps' },
      id: 'apps',
      label: t('appsTitle'),
      removable: false,
      target: { type: 'right-panel-resource', uri: RIGHT_PANEL_APPS_URL },
    },
    {
      builtIn: true,
      icon: { type: 'builtin', name: 'service-apps' },
      id: 'service-apps',
      label: t('serviceAppsTitle'),
      removable: false,
      target: { type: 'right-panel-resource', uri: RIGHT_PANEL_SERVICE_APPS_URL },
    },
    {
      builtIn: true,
      icon: { type: 'builtin', name: 'docs' },
      id: 'docs',
      label: t('docBrowserHelp'),
      removable: false,
      target: { type: 'right-panel-resource', uri: SIDE_DOCK_DOCS_URL },
    },
    {
      builtIn: true,
      icon: { type: 'builtin', name: 'new-tab' },
      id: 'new-tab',
      label: t('docBrowserHomeTitle'),
      removable: false,
      target: { type: 'right-panel-resource', uri: RIGHT_PANEL_HOME_URL },
    },
  ];
}

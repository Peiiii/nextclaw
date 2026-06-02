import {
  RIGHT_PANEL_APPS_URL,
  RIGHT_PANEL_HOME_URL,
  RIGHT_PANEL_SERVICE_APPS_URL,
} from '@/features/right-panel-resources';
import type { SideDockItem } from '@/features/side-dock/types/side-dock.types';

export const SIDE_DOCK_DOCS_URL = 'nextclaw://docs';

export const SIDE_DOCK_BUILT_IN_ITEMS: SideDockItem[] = [
  {
    builtIn: true,
    icon: { type: 'builtin', name: 'apps' },
    id: 'apps',
    labelKey: 'appsTitle',
    removable: false,
    target: { type: 'right-panel-resource', uri: RIGHT_PANEL_APPS_URL },
  },
  {
    builtIn: true,
    icon: { type: 'builtin', name: 'service-apps' },
    id: 'service-apps',
    labelKey: 'serviceAppsTitle',
    removable: false,
    target: { type: 'right-panel-resource', uri: RIGHT_PANEL_SERVICE_APPS_URL },
  },
  {
    builtIn: true,
    icon: { type: 'builtin', name: 'docs' },
    id: 'docs',
    labelKey: 'docBrowserHelp',
    removable: false,
    target: { type: 'right-panel-resource', uri: SIDE_DOCK_DOCS_URL },
  },
  {
    builtIn: true,
    icon: { type: 'builtin', name: 'new-tab' },
    id: 'new-tab',
    labelKey: 'docBrowserHomeTitle',
    removable: false,
    target: { type: 'right-panel-resource', uri: RIGHT_PANEL_HOME_URL },
  },
];

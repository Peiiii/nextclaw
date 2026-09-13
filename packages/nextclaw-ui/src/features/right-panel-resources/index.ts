export {
  createChatUiResourceReferenceFromTab,
  createPanelAppContentPath,
  createPanelAppResourceUri,
  createPanelAppRightPanelResourceTarget,
  readPanelAppIdFromResourceUri,
  readPanelAppIdFromTab,
  RIGHT_PANEL_APPS_TAB_KIND,
  RIGHT_PANEL_APPS_URL,
  RIGHT_PANEL_HOME_TAB_KIND,
  RIGHT_PANEL_HOME_URL,
  RIGHT_PANEL_PANEL_APP_TAB_KIND,
  RIGHT_PANEL_PANEL_APPS_URL,
  RIGHT_PANEL_SERVICE_APPS_URL,
} from '@/features/right-panel-resources/utils/right-panel-resource-uri.utils';
export { RightPanelResourceHomePage } from '@/features/right-panel-resources/components/right-panel-resource-home-page';
export { RightPanelResourceRouteResolver } from '@/features/right-panel-resources/utils/right-panel-resource-route-resolver.utils';
export type {
  RightPanelResourceHomeNavigationItem,
  RightPanelResourceKind,
  RightPanelResourceNavigationTarget,
  RightPanelResourceTarget,
} from '@/features/right-panel-resources/types/right-panel-resource.types';



export { PageResourceIcon } from './components/page-resource-icon';
export { PageResourceActionsMenu, PageResourceActionItems } from './components/page-resource-actions-menu';
export { PageResourceSidebarNav } from './components/page-resource-sidebar-nav';
export { SYSTEM_OBJECT_RESOURCE_RENDERERS } from './components/system-object-resource';
export { WORKSPACE_FILE_PANEL_RENDERERS } from './components/workspace-file-resource';
export { ResourcePage } from './pages/resource-page';
export { usePageResourceActions } from './hooks/use-page-resource-actions';
export { PageResourceManager, pageResourceTab } from './managers/page-resource.manager';
export { pageResourceFromTarget, pageResourceFromTab, pageResourceMainPath, pageResourceFromSystemObject } from './utils/page-resource-identity.utils';

import { PageResourceManager } from '@/features/right-panel-resources';
import { AccountManager } from '@/features/account';
import { viewportLayoutManager } from '@/app/managers/viewport-layout.manager';
import {
  ChatCompletionNotificationManager,
  ChatComposerIntentManager,
  ChatDraftIntentManager,
  useChatThreadStore,
} from '@/features/chat';
import { AppNotificationManager } from '@/features/notifications';
import { PanelAppHostPresenter } from '@/features/panel-apps';
import { InboxManager } from '@/features/inbox';
import { AppPackageOperationSettlementManager } from '@/features/apps';
import { RightPanelResourceRouteResolver } from '@/features/right-panel-resources';
import { RemoteAccessManager } from '@/features/remote';
import { SideDockManager } from '@/features/side-dock';
import { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';
import { useDocBrowserStore } from '@/shared/components/doc-browser/stores/doc-browser.store';
import { GLOBAL_WORKBENCH_SURFACE } from '@/shared/components/workbench/types/workbench-surface.types';
import { workbenchSurfaceManager } from '@/shared/components/workbench/managers/workbench-surface.manager';

type ChatThreadSnapshot = ReturnType<typeof useChatThreadStore.getState>['snapshot'];

function isChatWorkspacePanelOpen(snapshot: ChatThreadSnapshot): boolean {
  return snapshot.activeWorkspacePanelKind != null && !snapshot.workspacePanelHidden;
}

export class AppPresenter {
  workbenchSurfaceManager = workbenchSurfaceManager;
  notificationManager = new AppNotificationManager();
  inboxManager = new InboxManager();
  chatCompletionNotificationManager = new ChatCompletionNotificationManager(
    this.notificationManager,
  );
  accountManager = new AccountManager();
  rightPanelResourceRouteResolver = new RightPanelResourceRouteResolver();
  notifyRightPanelOpened = () => {
    const docBrowser = useDocBrowserStore.getState().snapshot;
    const chatThread = useChatThreadStore.getState().snapshot;
    viewportLayoutManager.collapseSidebarForDenseRightPanels({
      isDocBrowserDocked: this.workbenchSurfaceManager.get(GLOBAL_WORKBENCH_SURFACE).placement === 'docked',
      isDocBrowserOpen: docBrowser.isOpen,
      isWorkspacePanelOpen: isChatWorkspacePanelOpen(chatThread),
    });
  };
  notifyWorkspacePanelOpened = () => {
    const parentKey = useChatThreadStore.getState().snapshot.workspacePanelParentKey;
    this.workbenchSurfaceManager.restore(`session-workspace:${parentKey ?? 'draft'}`);
    this.notifyRightPanelOpened();
  };
  docBrowserManager = new DocBrowserManager(
    this.workbenchSurfaceManager,
    this.rightPanelResourceRouteResolver,
    this.notifyRightPanelOpened,
  );
  pageResourceManager = new PageResourceManager(this);
  appPackageOperationSettlementManager = new AppPackageOperationSettlementManager(
    this.docBrowserManager,
  );
  sideDockManager = new SideDockManager(this.docBrowserManager);
  chatComposerIntentManager = new ChatComposerIntentManager();
  chatDraftIntentManager = new ChatDraftIntentManager();
  panelAppHostPresenter = new PanelAppHostPresenter();
  serviceActionAuthorizationManager = this.panelAppHostPresenter.serviceActionAuthorizationManager;
  panelAppBridgeManager = this.panelAppHostPresenter.panelAppBridgeManager;
  remoteAccessManager = new RemoteAccessManager({
    accountManager: this.accountManager,
  });
}

let appPresenter: AppPresenter | null = null;

export function getAppPresenter() {
  appPresenter ??= new AppPresenter();
  return appPresenter;
}

export function getPresenter() {
  return getAppPresenter();
}

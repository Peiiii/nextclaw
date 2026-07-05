import { AccountManager } from '@/features/account';
import { viewportLayoutManager } from '@/app/managers/viewport-layout.manager';
import {
  ChatDraftIntentManager,
  useChatThreadStore,
} from '@/features/chat';
import { PanelAppBridgeManager } from '@/features/panel-apps';
import { RightPanelResourceRouteResolver } from '@/features/right-panel-resources';
import { RemoteAccessManager } from '@/features/remote';
import { ServiceActionAuthorizationManager } from '@/features/service-apps';
import { SideDockManager } from '@/features/side-dock';
import { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';
import { useDocBrowserStore } from '@/shared/components/doc-browser/stores/doc-browser.store';

type ChatThreadSnapshot = ReturnType<typeof useChatThreadStore.getState>['snapshot'];

function isChatWorkspacePanelOpen(snapshot: ChatThreadSnapshot): boolean {
  return snapshot.activeWorkspacePanelKind != null;
}

export class AppPresenter {
  accountManager = new AccountManager();
  rightPanelResourceRouteResolver = new RightPanelResourceRouteResolver();
  notifyRightPanelOpened = () => {
    const docBrowser = useDocBrowserStore.getState().snapshot;
    const chatThread = useChatThreadStore.getState().snapshot;
    viewportLayoutManager.collapseSidebarForDenseRightPanels({
      isDocBrowserDocked: docBrowser.mode === 'docked',
      isDocBrowserOpen: docBrowser.isOpen,
      isWorkspacePanelOpen: isChatWorkspacePanelOpen(chatThread),
    });
  };
  docBrowserManager = new DocBrowserManager(
    this.rightPanelResourceRouteResolver,
    this.notifyRightPanelOpened,
  );
  sideDockManager = new SideDockManager(this.docBrowserManager);
  chatDraftIntentManager = new ChatDraftIntentManager();
  serviceActionAuthorizationManager = new ServiceActionAuthorizationManager();
  panelAppBridgeManager = new PanelAppBridgeManager(this.serviceActionAuthorizationManager);
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

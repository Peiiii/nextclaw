import { AccountManager } from '@/features/account';
import { PanelAppBridgeManager } from '@/features/panel-apps';
import { RightPanelResourceRouteResolver } from '@/features/right-panel-resources';
import { RemoteAccessManager } from '@/features/remote';
import { ServiceActionAuthorizationManager } from '@/features/service-apps';
import { SideDockManager } from '@/features/side-dock';
import { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';

export class AppPresenter {
  accountManager = new AccountManager();
  rightPanelResourceRouteResolver = new RightPanelResourceRouteResolver();
  docBrowserManager = new DocBrowserManager(this.rightPanelResourceRouteResolver);
  sideDockManager = new SideDockManager(this.docBrowserManager);
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

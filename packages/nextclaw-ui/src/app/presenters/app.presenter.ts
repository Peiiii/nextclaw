import { AccountManager } from '@/features/account';
import { PanelAppBridgeManager } from '@/features/panel-apps';
import { RemoteAccessManager } from '@/features/remote';
import { ServiceActionAuthorizationManager } from '@/features/service-apps';

export class AppPresenter {
  accountManager = new AccountManager();
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

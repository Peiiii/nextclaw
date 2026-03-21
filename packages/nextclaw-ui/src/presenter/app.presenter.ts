import { AccountManager } from '@/account/managers/account.manager';
import { RemoteAccessManager } from '@/remote/managers/remote-access.manager';

export class AppPresenter {
  accountManager = new AccountManager();
  remoteAccessManager = new RemoteAccessManager();
}

export const appPresenter = new AppPresenter();

appPresenter.accountManager.bindSignedInContinuation(appPresenter.remoteAccessManager.resumePendingActionAfterSignIn);
appPresenter.remoteAccessManager.bindAccountManager(appPresenter.accountManager);

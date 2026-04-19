import { AccountManager } from '@/features/account';
import { RemoteAccessManager } from '@/features/remote';

export class AppManager {
  accountManager = new AccountManager();
  remoteAccessManager = new RemoteAccessManager();
}

export const appManager = new AppManager();

appManager.accountManager.bindSignedInContinuation(appManager.remoteAccessManager.resumePendingActionAfterSignIn);
appManager.remoteAccessManager.bindAccountManager(appManager.accountManager);

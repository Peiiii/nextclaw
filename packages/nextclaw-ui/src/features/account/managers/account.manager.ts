import { logoutRemote, pollRemoteBrowserAuth, startRemoteBrowserAuth, updateRemoteAccountProfile } from '@/shared/lib/api';
import type { RemoteAccessView } from '@/shared/lib/api';
import {
  ensureRemoteStatus,
  refreshRemoteStatus,
  resolveRemotePlatformApiBase,
  resolveRemoteWebBase
} from '@/features/remote';
import { formatDateTime, t } from '@/shared/lib/i18n';
import { toast } from 'sonner';
import { useAccountStore } from '@/features/account/stores/account.store';

type BrowserSignInCompletion = {
  resolve: (status: RemoteAccessView) => void;
  reject: (error: Error) => void;
};

export class AccountManager {
  private authPollTimerId: number | null = null;
  private browserSignInCompletion: BrowserSignInCompletion | null = null;

  openAccountPanel = () => {
    useAccountStore.getState().openPanel();
  };

  closeAccountPanel = () => {
    useAccountStore.getState().closePanel();
  };

  syncRemoteStatus = (status: RemoteAccessView | undefined) => {
    if (!status?.account.loggedIn) {
      return;
    }
    this.clearPollTimer();
    this.resolveBrowserSignIn(status);
    useAccountStore.getState().clearBrowserAuth();
  };

  ensureSignedIn = async (params?: { apiBase?: string; status?: RemoteAccessView }) => {
    const status = params?.status ?? (await ensureRemoteStatus());
    if (status.account.loggedIn) {
      return status;
    }
    this.openAccountPanel();
    return await this.startBrowserSignInAndWait({
      apiBase: params?.apiBase,
      status
    });
  };

  startBrowserSignInAndWait = async (params?: { apiBase?: string; status?: RemoteAccessView }) => {
    const completion = this.createBrowserSignInCompletion();
    await this.startBrowserSignIn(params);
    return await completion;
  };

  startBrowserSignIn = async (params?: {
    apiBase?: string;
    status?: RemoteAccessView;
  }) => {
    try {
      const apiBase = params?.apiBase;
      const status = params?.status ?? (await ensureRemoteStatus());
      const result = await startRemoteBrowserAuth({
        apiBase: resolveRemotePlatformApiBase(status, apiBase)
      });
      useAccountStore.getState().beginBrowserAuth({
        sessionId: result.sessionId,
        verificationUri: result.verificationUri,
        expiresAt: result.expiresAt,
        intervalMs: result.intervalMs,
        statusMessage: t('remoteBrowserAuthWaiting')
      });
      const opened = window.open(result.verificationUri, '_blank', 'noopener,noreferrer');
      if (!opened) {
        useAccountStore.getState().setAuthStatusMessage(t('remoteBrowserAuthPopupBlocked'));
      }
      this.scheduleBrowserAuthPoll();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('remoteBrowserAuthStartFailed');
      this.rejectBrowserSignIn(error);
      toast.error(`${t('remoteBrowserAuthStartFailed')}: ${message}`);
    }
  };

  resumeBrowserSignIn = () => {
    const verificationUri = useAccountStore.getState().authVerificationUri;
    if (!verificationUri) {
      return;
    }
    window.open(verificationUri, '_blank', 'noopener,noreferrer');
  };

  logout = async () => {
    try {
      await logoutRemote();
      this.rejectBrowserSignIn(new Error('Signed out before browser sign-in completed.'));
      useAccountStore.getState().clearBrowserAuth();
      await refreshRemoteStatus();
      toast.success(t('remoteLogoutSuccess'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('remoteLogoutFailed');
      toast.error(`${t('remoteLogoutFailed')}: ${message}`);
    }
  };

  updateUsername = async (username: string) => {
    try {
      await updateRemoteAccountProfile({
        username: username.trim()
      });
      await refreshRemoteStatus();
      toast.success(t('remoteAccountUsernameSetSuccess'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('remoteAccountUsernameSetFailed');
      toast.error(`${t('remoteAccountUsernameSetFailed')}: ${message}`);
    }
  };

  openNextClawWeb = async (path = '/') => {
    const status = await ensureRemoteStatus();
    const webBase = resolveRemoteWebBase(status);
    if (!webBase) {
      toast.error(t('remoteOpenWebUnavailable'));
      return;
    }
    const targetUrl = new URL(path, `${webBase.replace(/\/+$/, '')}/`).toString();
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  private scheduleBrowserAuthPoll = () => {
    this.clearPollTimer();
    const { authSessionId, authPollIntervalMs } = useAccountStore.getState();
    if (!authSessionId) {
      return;
    }
    this.authPollTimerId = window.setTimeout(async () => {
      await this.pollBrowserSignIn();
    }, authPollIntervalMs);
  };

  private pollBrowserSignIn = async () => {
    const store = useAccountStore.getState();
    if (!store.authSessionId) {
      return;
    }

    try {
      const status = await ensureRemoteStatus();
      const result = await pollRemoteBrowserAuth({
        sessionId: store.authSessionId,
        apiBase: resolveRemotePlatformApiBase(status)
      });
      if (result.status === 'pending') {
        useAccountStore.getState().updateBrowserAuth({
          statusMessage: t('remoteBrowserAuthWaiting'),
          intervalMs: result.nextPollMs ?? 1500
        });
        this.scheduleBrowserAuthPoll();
        return;
      }
      if (result.status === 'expired') {
        this.clearPollTimer();
        this.rejectBrowserSignIn(new Error(result.message || t('remoteBrowserAuthExpired')));
        useAccountStore.getState().clearBrowserAuth();
        toast.error(result.message || t('remoteBrowserAuthExpired'));
        return;
      }

      useAccountStore.getState().setAuthStatusMessage(t('remoteBrowserAuthCompleted'));
      const nextStatus = await refreshRemoteStatus();
      this.clearPollTimer();
      this.resolveBrowserSignIn(nextStatus);
      useAccountStore.getState().clearBrowserAuth();
      toast.success(t('remoteLoginSuccess'));
    } catch (error) {
      this.clearPollTimer();
      this.rejectBrowserSignIn(error);
      useAccountStore.getState().clearBrowserAuth();
      const message = error instanceof Error ? error.message : t('remoteBrowserAuthPollFailed');
      toast.error(`${t('remoteBrowserAuthPollFailed')}: ${message}`);
    }
  };

  private clearPollTimer = () => {
    if (this.authPollTimerId !== null) {
      window.clearTimeout(this.authPollTimerId);
      this.authPollTimerId = null;
    }
  };

  private createBrowserSignInCompletion = () => {
    this.rejectBrowserSignIn(new Error('Browser sign-in was replaced by a newer request.'));
    return new Promise<RemoteAccessView>((resolve, reject) => {
      this.browserSignInCompletion = {
        resolve,
        reject
      };
    });
  };

  private resolveBrowserSignIn = (status: RemoteAccessView) => {
    const completion = this.browserSignInCompletion;
    if (!completion) {
      return;
    }
    this.browserSignInCompletion = null;
    completion.resolve(status);
  };

  private rejectBrowserSignIn = (error: unknown) => {
    const completion = this.browserSignInCompletion;
    if (!completion) {
      return;
    }
    this.browserSignInCompletion = null;
    completion.reject(error instanceof Error ? error : new Error(String(error)));
  };

  getBrowserAuthSummary = () => {
    const store = useAccountStore.getState();
    return {
      sessionId: store.authSessionId,
      expiresAt: store.authExpiresAt ? formatDateTime(store.authExpiresAt) : '-'
    };
  };
}

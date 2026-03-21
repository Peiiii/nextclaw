import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRemoteStatus } from '@/hooks/useRemoteAccess';
import { formatDateTime, t } from '@/lib/i18n';
import { useAccountStore } from '@/account/stores/account.store';
import { useAppPresenter } from '@/presenter/app-presenter-context';
import { KeyRound, LogOut, SquareArrowOutUpRight } from 'lucide-react';
import { useEffect } from 'react';

function AccountValueRow(props: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-gray-500">{props.label}</span>
      <span className="text-right text-gray-900">{props.value?.trim() || '-'}</span>
    </div>
  );
}

export function AccountPanel() {
  const presenter = useAppPresenter();
  const remoteStatus = useRemoteStatus();
  const panelOpen = useAccountStore((state) => state.panelOpen);
  const authSessionId = useAccountStore((state) => state.authSessionId);
  const authVerificationUri = useAccountStore((state) => state.authVerificationUri);
  const authExpiresAt = useAccountStore((state) => state.authExpiresAt);
  const authStatusMessage = useAccountStore((state) => state.authStatusMessage);
  const status = remoteStatus.data;

  useEffect(() => {
    presenter.accountManager.syncRemoteStatus(status);
  }, [presenter, status]);

  return (
    <Dialog open={panelOpen} onOpenChange={(open) => (open ? presenter.accountManager.openAccountPanel() : presenter.accountManager.closeAccountPanel())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {t('accountPanelTitle')}
          </DialogTitle>
          <DialogDescription>{t('accountPanelDescription')}</DialogDescription>
        </DialogHeader>

        {status?.account.loggedIn ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-medium text-emerald-800">{t('accountPanelSignedInTitle')}</p>
              <p className="mt-1 text-sm text-emerald-700">{t('accountPanelSignedInDescription')}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <AccountValueRow label={t('remoteAccountEmail')} value={status.account.email} />
              <AccountValueRow label={t('remoteAccountRole')} value={status.account.role} />
              <AccountValueRow label={t('remotePublicPlatform')} value={status.platformBase ?? status.account.platformBase} />
              <AccountValueRow label={t('remoteApiBase')} value={status.account.apiBase} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void presenter.accountManager.openNextClawWeb()}>
                <SquareArrowOutUpRight className="mr-2 h-4 w-4" />
                {t('remoteOpenWeb')}
              </Button>
              <Button variant="outline" onClick={() => void presenter.accountManager.logout()}>
                <LogOut className="mr-2 h-4 w-4" />
                {t('remoteLogout')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{t('accountPanelSignedOutTitle')}</p>
              <p className="mt-1 text-sm text-gray-600">{t('accountPanelSignedOutDescription')}</p>
              <div className="mt-3 border-t border-white/80 pt-3">
                <AccountValueRow label={t('remoteBrowserAuthSession')} value={authSessionId} />
                <AccountValueRow label={t('remoteBrowserAuthExpiresAt')} value={authExpiresAt ? formatDateTime(authExpiresAt) : '-'} />
                <AccountValueRow label={t('remotePublicPlatform')} value={status?.platformBase ?? status?.account.platformBase} />
              </div>
            </div>
            {authStatusMessage ? <p className="text-sm text-gray-600">{authStatusMessage}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void presenter.accountManager.startBrowserSignIn()}>
                {authSessionId ? t('remoteBrowserAuthActionRetry') : t('remoteBrowserAuthAction')}
              </Button>
              {authVerificationUri ? (
                <Button variant="outline" onClick={() => presenter.accountManager.resumeBrowserSignIn()}>
                  {t('remoteBrowserAuthResume')}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

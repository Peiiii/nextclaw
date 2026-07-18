import type { RemoteShareGrant } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDateTime, type LocaleCode } from '@/i18n/i18n.service';

type Translate = (key: string, params?: Record<string, string | number>) => string;

type RemoteShareGrantPanelProps = {
  locale: LocaleCode;
  t: Translate;
  instanceId: string;
  grants: RemoteShareGrant[];
  isLoading: boolean;
  error: unknown;
  isCreatingShare: boolean;
  isRevokingShare: boolean;
  onClose: () => void;
  onCreateShare: (instanceId: string) => void;
  onCopyShareUrl: (shareUrl: string) => void;
  onRevokeShare: (grantId: string, instanceId: string) => void;
};

export function RemoteShareGrantPanel(props: RemoteShareGrantPanelProps): JSX.Element {
  return (
    <div className="space-y-3 rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#1f1f1d]">{props.t('remote.sharePanel.title')}</p>
          <p className="text-sm leading-6 text-[#656561]">{props.t('remote.sharePanel.description')}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="secondary" className="h-9" onClick={() => props.onCreateShare(props.instanceId)} disabled={props.isCreatingShare}>
            {props.t('remote.actions.createShare')}
          </Button>
          <Button type="button" variant="ghost" className="h-9" onClick={props.onClose}>
            {props.t('remote.actions.closeSharePanel')}
          </Button>
        </div>
      </div>

      {props.isLoading ? <p className="text-sm text-[#8f8a7d]">{props.t('remote.messages.loadingShares')}</p> : null}
      {props.error ? (
        <p className="text-sm text-rose-600">
          {props.error instanceof Error ? props.error.message : props.t('remote.messages.loadSharesFailed')}
        </p>
      ) : null}
      {!props.isLoading && props.grants.length === 0 ? <p className="text-sm text-[#8f8a7d]">{props.t('remote.messages.noShares')}</p> : null}

      <div className="space-y-3">
        {props.grants.map((grant) => (
          <div key={grant.id} className="rounded-xl border border-[#e4e0d7] bg-white p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#1f1f1d]">
                  {grant.status === 'active'
                    ? props.t('remote.status.shareActive')
                    : grant.status === 'revoked'
                      ? props.t('remote.status.shareRevoked')
                      : props.t('remote.status.shareExpired')}
                </p>
                <p className="text-xs text-[#8f8a7d]">
                  {props.t('remote.sharePanel.meta', {
                    createdAt: formatDateTime(props.locale, grant.createdAt),
                    expiresAt: formatDateTime(props.locale, grant.expiresAt)
                  })}
                </p>
                <p className="text-xs text-[#8f8a7d]">
                  {props.t('remote.sharePanel.activeSessions', { count: grant.activeSessionCount })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={() => props.onCopyShareUrl(grant.shareUrl)}>
                  {props.t('common.copyLink')}
                </Button>
                <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => window.open(grant.shareUrl, '_blank', 'noopener,noreferrer')}>
                  {props.t('common.openLink')}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="h-8 px-2 text-xs"
                  onClick={() => props.onRevokeShare(grant.id, grant.instanceId)}
                  disabled={grant.status !== 'active' || props.isRevokingShare}
                >
                  {props.t('common.revoke')}
                </Button>
              </div>
            </div>
            <Input className="mt-3" value={grant.shareUrl} readOnly />
          </div>
        ))}
      </div>
    </div>
  );
}

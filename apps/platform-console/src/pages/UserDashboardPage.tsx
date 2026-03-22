import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRemoteShareGrant,
  fetchRemoteInstances,
  fetchRemoteShareGrants,
  openRemoteInstance,
  revokeRemoteShareGrant
} from '@/api/client';
import type { RemoteInstance, RemoteShareGrant } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TableWrap } from '@/components/ui/table';
import { createTranslator, formatDateTime, type LocaleCode } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';

type Props = {
  token: string;
};

type Translate = (key: string, params?: Record<string, string | number>) => string;

type RemoteInstancesTableProps = {
  locale: LocaleCode;
  t: Translate;
  instances: RemoteInstance[];
  isLoading: boolean;
  resolvedInstanceId: string | null;
  isCreatingShare: boolean;
  isOpeningInstance: boolean;
  onCreateShare: (instanceId: string) => void;
  onSelectInstance: (instanceId: string) => void;
  onOpenInstance: (instanceId: string) => void;
};

type RemoteShareGrantPanelProps = {
  locale: LocaleCode;
  t: Translate;
  instanceId: string | null;
  grants: RemoteShareGrant[];
  isLoading: boolean;
  error: unknown;
  isCreatingShare: boolean;
  isRevokingShare: boolean;
  onCreateShare: (instanceId: string) => void;
  onCopyShareUrl: (shareUrl: string) => void;
  onRevokeShare: (grantId: string, instanceId: string) => void;
};

function RemoteInstancesTable({
  locale,
  t,
  instances,
  isLoading,
  resolvedInstanceId,
  isCreatingShare,
  isOpeningInstance,
  onCreateShare,
  onSelectInstance,
  onOpenInstance
}: RemoteInstancesTableProps): JSX.Element {
  return (
    <TableWrap>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">{t('remote.table.instance')}</th>
            <th className="px-3 py-2">{t('remote.table.platform')}</th>
            <th className="px-3 py-2">{t('remote.table.status')}</th>
            <th className="px-3 py-2">{t('remote.table.lastSeenAt')}</th>
            <th className="px-3 py-2 text-right">{t('remote.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {instances.map((instance) => (
            <tr key={instance.id} className="border-t border-slate-100">
              <td className="px-3 py-2">
                <div className="font-medium text-slate-900">{instance.displayName}</div>
                <div className="text-xs text-slate-500">{instance.appVersion}</div>
              </td>
              <td className="px-3 py-2">{instance.platform}</td>
              <td className="px-3 py-2">
                <span className={instance.status === 'online' ? 'text-emerald-600' : 'text-slate-500'}>
                  {instance.status === 'online' ? t('remote.status.online') : t('remote.status.offline')}
                </span>
              </td>
              <td className="px-3 py-2">{formatDateTime(locale, instance.lastSeenAt)}</td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => onCreateShare(instance.id)}
                    disabled={isCreatingShare}
                  >
                    {t('remote.actions.createShare')}
                  </Button>
                  <Button
                    variant={resolvedInstanceId === instance.id ? 'ghost' : 'secondary'}
                    onClick={() => onSelectInstance(instance.id)}
                  >
                    {t('remote.actions.viewShare')}
                  </Button>
                  <Button
                    onClick={() => onOpenInstance(instance.id)}
                    disabled={instance.status !== 'online' || isOpeningInstance}
                  >
                    {t('remote.actions.openInWeb')}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {!isLoading && instances.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-sm text-slate-500">
                {t('remote.messages.empty')}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </TableWrap>
  );
}

function RemoteShareGrantPanel({
  locale,
  t,
  instanceId,
  grants,
  isLoading,
  error,
  isCreatingShare,
  isRevokingShare,
  onCreateShare,
  onCopyShareUrl,
  onRevokeShare
}: RemoteShareGrantPanelProps): JSX.Element | null {
  if (!instanceId) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{t('remote.sharePanel.title')}</p>
          <p className="text-sm text-slate-500">{t('remote.sharePanel.description')}</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => onCreateShare(instanceId)}
          disabled={isCreatingShare}
        >
          {t('remote.actions.createAnotherShare')}
        </Button>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">{t('remote.messages.loadingShares')}</p> : null}
      {error ? (
        <p className="text-sm text-rose-600">
          {error instanceof Error ? error.message : t('remote.messages.loadSharesFailed')}
        </p>
      ) : null}
      {!isLoading && grants.length === 0 ? <p className="text-sm text-slate-500">{t('remote.messages.noShares')}</p> : null}

      <div className="space-y-3">
        {grants.map((grant) => (
          <div key={grant.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {grant.status === 'active'
                    ? t('remote.status.shareActive')
                    : grant.status === 'revoked'
                      ? t('remote.status.shareRevoked')
                      : t('remote.status.shareExpired')}
                </p>
                <p className="text-xs text-slate-500">
                  {t('remote.sharePanel.meta', {
                    createdAt: formatDateTime(locale, grant.createdAt),
                    expiresAt: formatDateTime(locale, grant.expiresAt)
                  })}
                </p>
                <p className="text-xs text-slate-500">
                  {t('remote.sharePanel.activeSessions', { count: grant.activeSessionCount })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => onCopyShareUrl(grant.shareUrl)}>
                  {t('common.copyLink')}
                </Button>
                <Button variant="ghost" onClick={() => window.open(grant.shareUrl, '_blank', 'noopener,noreferrer')}>
                  {t('common.openLink')}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => onRevokeShare(grant.id, grant.instanceId)}
                  disabled={grant.status !== 'active' || isRevokingShare}
                >
                  {t('common.revoke')}
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

function BillingComingSoonCard(props: {
  t: Translate;
}): JSX.Element {
  return (
    <Card className="rounded-[28px] border-slate-200/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <CardTitle>{props.t('billing.title')}</CardTitle>
          <p className="text-sm leading-6 text-slate-500">{props.t('billing.description')}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          {props.t('billing.badge')}
        </span>
      </div>
    </Card>
  );
}

function RemoteInstancesCard(props: {
  locale: LocaleCode;
  t: Translate;
  token: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const remoteInstancesQuery = useQuery({
    queryKey: ['remote-instances'],
    queryFn: async () => await fetchRemoteInstances(props.token)
  });

  const resolvedInstanceId = selectedInstanceId ?? remoteInstancesQuery.data?.items?.[0]?.id ?? null;

  const remoteShareGrantsQuery = useQuery({
    queryKey: ['remote-share-grants', resolvedInstanceId],
    enabled: Boolean(resolvedInstanceId),
    queryFn: async () => await fetchRemoteShareGrants(props.token, resolvedInstanceId ?? '')
  });

  const openRemoteInstanceMutation = useMutation({
    mutationFn: async (instanceId: string) => await openRemoteInstance(props.token, instanceId),
    onSuccess: (session) => {
      window.open(session.openUrl, '_blank', 'noopener,noreferrer');
    }
  });

  const createRemoteShareMutation = useMutation({
    mutationFn: async (instanceId: string) => await createRemoteShareGrant(props.token, instanceId),
    onSuccess: async (grant) => {
      setSelectedInstanceId(grant.instanceId);
      await queryClient.invalidateQueries({ queryKey: ['remote-share-grants', grant.instanceId] });
      try {
        await navigator.clipboard.writeText(grant.shareUrl);
        setShareFeedback(props.t('remote.messages.newShareCopied'));
      } catch {
        setShareFeedback(props.t('remote.messages.newShareCreated'));
      }
    }
  });

  const revokeRemoteShareMutation = useMutation({
    mutationFn: async (params: { grantId: string; instanceId: string }) => await revokeRemoteShareGrant(props.token, params.grantId),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['remote-share-grants', variables.instanceId] });
      setShareFeedback(props.t('remote.messages.shareRevoked'));
    }
  });

  async function copyShareUrl(shareUrl: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareFeedback(props.t('remote.messages.shareCopied'));
    } catch {
      setShareFeedback(props.t('remote.messages.shareCopyManual'));
    }
  }

  return (
    <Card className="space-y-4 rounded-[28px] border-slate-200/80 p-5">
      <CardTitle>{props.t('remote.title')}</CardTitle>
      <p className="text-sm text-slate-500">{props.t('remote.description')}</p>
      <RemoteInstancesTable
        locale={props.locale}
        t={props.t}
        instances={remoteInstancesQuery.data?.items ?? []}
        isLoading={remoteInstancesQuery.isLoading}
        resolvedInstanceId={resolvedInstanceId}
        isCreatingShare={createRemoteShareMutation.isPending}
        isOpeningInstance={openRemoteInstanceMutation.isPending}
        onCreateShare={(instanceId) => {
          setSelectedInstanceId(instanceId);
          void createRemoteShareMutation.mutateAsync(instanceId);
        }}
        onSelectInstance={setSelectedInstanceId}
        onOpenInstance={(instanceId) => openRemoteInstanceMutation.mutate(instanceId)}
      />
      {remoteInstancesQuery.error ? (
        <p className="text-sm text-rose-600">
          {remoteInstancesQuery.error instanceof Error ? remoteInstancesQuery.error.message : props.t('remote.messages.loadInstancesFailed')}
        </p>
      ) : null}
      {openRemoteInstanceMutation.error ? (
        <p className="text-sm text-rose-600">
          {openRemoteInstanceMutation.error instanceof Error ? openRemoteInstanceMutation.error.message : props.t('remote.messages.openInstanceFailed')}
        </p>
      ) : null}
      {createRemoteShareMutation.error ? (
        <p className="text-sm text-rose-600">
          {createRemoteShareMutation.error instanceof Error ? createRemoteShareMutation.error.message : props.t('remote.messages.createShareFailed')}
        </p>
      ) : null}
      {revokeRemoteShareMutation.error ? (
        <p className="text-sm text-rose-600">
          {revokeRemoteShareMutation.error instanceof Error ? revokeRemoteShareMutation.error.message : props.t('remote.messages.revokeShareFailed')}
        </p>
      ) : null}
      {shareFeedback ? <p className="text-sm text-slate-600">{shareFeedback}</p> : null}

      <RemoteShareGrantPanel
        locale={props.locale}
        t={props.t}
        instanceId={resolvedInstanceId}
        grants={remoteShareGrantsQuery.data?.items ?? []}
        isLoading={remoteShareGrantsQuery.isLoading}
        error={remoteShareGrantsQuery.error}
        isCreatingShare={createRemoteShareMutation.isPending}
        isRevokingShare={revokeRemoteShareMutation.isPending}
        onCreateShare={(instanceId) => void createRemoteShareMutation.mutateAsync(instanceId)}
        onCopyShareUrl={(shareUrl) => void copyShareUrl(shareUrl)}
        onRevokeShare={(grantId, instanceId) => revokeRemoteShareMutation.mutate({ grantId, instanceId })}
      />
    </Card>
  );
}

export function UserDashboardPage({ token }: Props): JSX.Element {
  const locale = useLocaleStore((state) => state.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);

  return (
    <div className="space-y-6">
      <RemoteInstancesCard locale={locale} t={t} token={token} />
      <BillingComingSoonCard t={t} />
    </div>
  );
}

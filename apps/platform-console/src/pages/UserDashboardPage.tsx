import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchRemoteQuotaSummary,
} from '@/api/client';
import type { RemoteInstance, RemoteQuotaSummary, RemoteShareGrant, UserView } from '@/api/types';
import { AccountSummaryCard } from '@/components/account/account-summary-card';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TableWrap } from '@/components/ui/table';
import { createTranslator, formatDateTime, type LocaleCode } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';
import { useRemoteInstancesCardState } from '@/pages/UserDashboardPage.remote-state';

type Props = {
  token: string;
  user: UserView;
  highlightAccount: boolean;
};

type Translate = (key: string, params?: Record<string, string | number>) => string;

type RemoteInstancesTableProps = {
  locale: LocaleCode;
  t: Translate;
  instances: RemoteInstance[];
  isLoading: boolean;
  resolvedInstanceId: string | null;
  isArchivingInstance: boolean;
  isCreatingShare: boolean;
  isOpeningInstance: boolean;
  onArchiveInstance: (instanceId: string) => void;
  onCreateShare: (instanceId: string) => void;
  onSelectInstance: (instanceId: string) => void;
  onOpenInstance: (instanceId: string, entry: 'subdomain' | 'fixed_domain') => void;
};

type ArchivedInstancesPanelProps = {
  locale: LocaleCode;
  t: Translate;
  instances: RemoteInstance[];
  isLoading: boolean;
  error: unknown;
  isDeletingInstance: boolean;
  isRestoringInstance: boolean;
  onDeleteInstance: (instanceId: string) => void;
  onRestoreInstance: (instanceId: string) => void;
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
  isArchivingInstance,
  isCreatingShare,
  isOpeningInstance,
  onArchiveInstance,
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
                <div className="flex flex-wrap justify-end gap-2">
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
                    onClick={() => onOpenInstance(instance.id, 'subdomain')}
                    disabled={instance.status !== 'online' || isOpeningInstance}
                  >
                    {t('remote.actions.openInWeb')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => onOpenInstance(instance.id, 'fixed_domain')}
                    disabled={instance.status !== 'online' || isOpeningInstance}
                  >
                    {t('remote.actions.openWithFixedDomain')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => onArchiveInstance(instance.id)}
                    disabled={isArchivingInstance}
                  >
                    {t('remote.actions.archive')}
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

function ArchivedInstancesPanel({
  locale,
  t,
  instances,
  isLoading,
  error,
  isDeletingInstance,
  isRestoringInstance,
  onDeleteInstance,
  onRestoreInstance
}: ArchivedInstancesPanelProps): JSX.Element | null {
  if (!isLoading && !error && instances.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
      <div>
        <p className="text-sm font-medium text-slate-900">{t('remote.archived.title')}</p>
        <p className="text-sm text-slate-500">{t('remote.archived.description')}</p>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">{t('remote.archived.loading')}</p> : null}
      {error ? (
        <p className="text-sm text-rose-600">
          {error instanceof Error ? error.message : t('remote.archived.loadFailed')}
        </p>
      ) : null}

      {!isLoading && !error ? (
        <TableWrap>
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
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
                <tr key={instance.id} className="border-t border-slate-100 bg-white">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{instance.displayName}</div>
                    <div className="text-xs text-slate-500">{instance.appVersion}</div>
                    {instance.archivedAt ? (
                      <div className="text-xs text-slate-400">
                        {t('remote.archived.archivedAt', {
                          archivedAt: formatDateTime(locale, instance.archivedAt)
                        })}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{instance.platform}</td>
                  <td className="px-3 py-2">
                    <span className="text-slate-500">{t('remote.status.archived')}</span>
                  </td>
                  <td className="px-3 py-2">{formatDateTime(locale, instance.lastSeenAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => onRestoreInstance(instance.id)}
                        disabled={isRestoringInstance}
                      >
                        {t('remote.actions.restore')}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => onDeleteInstance(instance.id)}
                        disabled={isDeletingInstance}
                      >
                        {t('remote.actions.delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {instances.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-sm text-slate-500">
                    {t('remote.archived.empty')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      ) : null}
    </div>
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

function RemoteQuotaCard(props: {
  locale: LocaleCode;
  t: Translate;
  token: string;
}): JSX.Element {
  const quotaQuery = useQuery({
    queryKey: ['remote-quota-summary'],
    queryFn: async () => await fetchRemoteQuotaSummary(props.token)
  });

  return (
    <Card className="rounded-[28px] border-slate-200/80 p-5">
      <div className="space-y-2">
        <CardTitle>{props.t('remote.quota.title')}</CardTitle>
        <p className="text-sm leading-6 text-slate-500">{props.t('remote.quota.description')}</p>
      </div>

      {quotaQuery.isLoading ? (
        <p className="mt-4 text-sm text-slate-500">{props.t('remote.quota.messages.loading')}</p>
      ) : null}
      {quotaQuery.error ? (
        <p className="mt-4 text-sm text-rose-600">
          {quotaQuery.error instanceof Error ? quotaQuery.error.message : props.t('remote.quota.messages.loadFailed')}
        </p>
      ) : null}
      {quotaQuery.data ? <RemoteQuotaSummaryGrid locale={props.locale} t={props.t} summary={quotaQuery.data} /> : null}
    </Card>
  );
}

function RemoteQuotaSummaryGrid(props: {
  locale: LocaleCode;
  t: Translate;
  summary: RemoteQuotaSummary;
}): JSX.Element {
  const { summary, t } = props;
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="grid gap-3 sm:grid-cols-2">
        <QuotaMetricCard
          label={t('remote.quota.worker.title')}
          used={summary.workerRequests.used}
          limit={summary.workerRequests.limit}
          subtitle={t('remote.quota.remaining', {
            value: formatQuotaValue(summary.workerRequests.remaining),
            unit: t('remote.quota.units.requests')
          })}
          unitLabel={t('remote.quota.units.requests')}
        />
        <QuotaMetricCard
          label={t('remote.quota.do.title')}
          used={summary.durableObjectRequests.used}
          limit={summary.durableObjectRequests.limit}
          subtitle={t('remote.quota.remaining', {
            value: formatQuotaValue(summary.durableObjectRequests.remaining),
            unit: t('remote.quota.units.requestUnits')
          })}
          unitLabel={t('remote.quota.units.requestUnits')}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="text-sm font-medium text-slate-900">{t('remote.quota.runtime.title')}</p>
        <dl className="mt-3 space-y-3 text-sm">
          <QuotaMetaRow label={t('remote.quota.runtime.sessionLimit')} value={formatQuotaValue(summary.sessionRequestsPerMinute)} />
          <QuotaMetaRow label={t('remote.quota.runtime.activeConnections')} value={formatQuotaValue(summary.activeBrowserConnections)} />
          <QuotaMetaRow label={t('remote.quota.runtime.instanceConnectionLimit')} value={formatQuotaValue(summary.instanceConnectionsPerInstance)} />
          <QuotaMetaRow label={t('remote.quota.runtime.resetAt')} value={formatDateTime(props.locale, summary.resetsAt)} />
        </dl>
      </div>
    </div>
  );
}

function QuotaMetricCard(props: {
  label: string;
  used: number;
  limit: number;
  subtitle: string;
  unitLabel: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-sm font-medium text-slate-900">{props.label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
        {formatQuotaValue(props.used)}
        <span className="ml-2 text-sm font-medium text-slate-500">/ {formatQuotaValue(props.limit)} {props.unitLabel}</span>
      </p>
      <p className="mt-2 text-sm text-slate-500">{props.subtitle}</p>
    </div>
  );
}

function QuotaMetaRow(props: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{props.label}</dt>
      <dd className="font-medium text-slate-900">{props.value}</dd>
    </div>
  );
}

function formatQuotaValue(value: number): string {
  if (Number.isInteger(value)) {
    return new Intl.NumberFormat().format(value);
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function RemoteInstancesCard(props: {
  locale: LocaleCode;
  t: Translate;
  token: string;
}): JSX.Element {
  const {
    archivedInstances,
    archivedInstancesQuery,
    archiveRemoteInstanceMutation,
    copyShareUrl,
    createRemoteShareMutation,
    deleteRemoteInstanceMutation,
    handleArchiveInstance,
    handleDeleteInstance,
    handleRestoreInstance,
    openRemoteInstanceMutation,
    remoteInstancesQuery,
    remoteShareGrantsQuery,
    resolvedInstanceId,
    revokeRemoteShareMutation,
    setSelectedInstanceId,
    shareFeedback,
    unarchiveRemoteInstanceMutation
  } = useRemoteInstancesCardState({
    token: props.token,
    t: props.t
  });

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
        isArchivingInstance={archiveRemoteInstanceMutation.isPending}
        isCreatingShare={createRemoteShareMutation.isPending}
        isOpeningInstance={openRemoteInstanceMutation.isPending}
        onArchiveInstance={handleArchiveInstance}
        onCreateShare={(instanceId) => {
          setSelectedInstanceId(instanceId);
          void createRemoteShareMutation.mutateAsync(instanceId);
        }}
        onSelectInstance={setSelectedInstanceId}
        onOpenInstance={(instanceId, entry) => openRemoteInstanceMutation.mutate({ instanceId, entry })}
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
      {archiveRemoteInstanceMutation.error ? (
        <p className="text-sm text-rose-600">
          {archiveRemoteInstanceMutation.error instanceof Error ? archiveRemoteInstanceMutation.error.message : props.t('remote.messages.archiveFailed')}
        </p>
      ) : null}
      {unarchiveRemoteInstanceMutation.error ? (
        <p className="text-sm text-rose-600">
          {unarchiveRemoteInstanceMutation.error instanceof Error ? unarchiveRemoteInstanceMutation.error.message : props.t('remote.messages.restoreFailed')}
        </p>
      ) : null}
      {deleteRemoteInstanceMutation.error ? (
        <p className="text-sm text-rose-600">
          {deleteRemoteInstanceMutation.error instanceof Error ? deleteRemoteInstanceMutation.error.message : props.t('remote.messages.deleteFailed')}
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
      <ArchivedInstancesPanel
        locale={props.locale}
        t={props.t}
        instances={archivedInstances}
        isLoading={archivedInstancesQuery.isLoading}
        error={archivedInstancesQuery.error}
        isDeletingInstance={deleteRemoteInstanceMutation.isPending}
        isRestoringInstance={unarchiveRemoteInstanceMutation.isPending}
        onDeleteInstance={handleDeleteInstance}
        onRestoreInstance={handleRestoreInstance}
      />
    </Card>
  );
}

export function UserDashboardPage({ token, user, highlightAccount }: Props): JSX.Element {
  const locale = useLocaleStore((state) => state.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);

  return (
    <div className="space-y-6">
      <AccountSummaryCard token={token} user={user} t={t} highlight={highlightAccount} />
      <RemoteQuotaCard locale={locale} t={t} token={token} />
      <RemoteInstancesCard locale={locale} t={t} token={token} />
      <BillingComingSoonCard t={t} />
    </div>
  );
}

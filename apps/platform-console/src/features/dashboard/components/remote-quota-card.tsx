import { useQuery } from '@tanstack/react-query';
import { Card, CardTitle } from '@/shared/components/card';
import { formatDateTime, type LocaleCode } from '@/i18n/i18n.service';
import type { RemoteQuotaResourceSummary, RemoteQuotaSummary } from '@/features/dashboard/types/remote-quota.types';
import { fetchRemoteQuotaSummary } from '@/features/dashboard/utils/remote-quota-api.utils';

type Translate = (key: string, params?: Record<string, string | number>) => string;

type Props = {
  locale: LocaleCode;
  t: Translate;
  token: string;
};

export function RemoteQuotaCard({ locale, t, token }: Props): JSX.Element {
  const quotaQuery = useQuery({
    queryKey: ['remote-quota-summary', 'v2'],
    queryFn: async () => await fetchRemoteQuotaSummary(token),
    refetchInterval: 60_000
  });

  return (
    <Card className="rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <CardTitle>{t('remote.quota.title')}</CardTitle>
          <p className="max-w-3xl text-sm leading-6 text-[var(--color-foreground-muted)]">{t('remote.quota.description')}</p>
        </div>
        {quotaQuery.data ? <QuotaStatusBadge status={quotaQuery.data.day.status} t={t} /> : null}
      </div>

      {quotaQuery.isLoading ? (
        <p className="mt-4 text-sm text-[var(--color-foreground-subtle)]">{t('remote.quota.messages.loading')}</p>
      ) : null}
      {quotaQuery.error ? (
        <p className="mt-4 text-sm text-rose-600">
          {quotaQuery.error instanceof Error ? quotaQuery.error.message : t('remote.quota.messages.loadFailed')}
        </p>
      ) : null}
      {quotaQuery.data ? <RemoteQuotaSummaryView locale={locale} t={t} summary={quotaQuery.data} /> : null}
    </Card>
  );
}

function RemoteQuotaSummaryView(props: {
  locale: LocaleCode;
  t: Translate;
  summary: RemoteQuotaSummary;
}): JSX.Element {
  const { locale, summary, t } = props;
  return (
    <div className="mt-5 space-y-4">
      {summary.costModel.partialDay ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t('remote.quota.partialDay')}
        </p>
      ) : null}

      <DailyQuotaOverview summary={summary} t={t} />

      <div className="grid gap-3 md:grid-cols-2">
        <QuotaResourceCard
          label={t('remote.quota.worker.title')}
          resource={summary.day.workerRequests}
          unitLabel={t('remote.quota.units.requests')}
          t={t}
        />
        <QuotaResourceCard
          label={t('remote.quota.do.title')}
          resource={summary.day.durableObjectRequests}
          unitLabel={t('remote.quota.units.requestUnits')}
          t={t}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-4">
          <p className="text-sm font-medium text-[var(--color-foreground)]">{t('remote.quota.recent.title')}</p>
          <dl className="mt-3 space-y-3 text-sm">
            <QuotaMetaRow
              label={t('remote.quota.recent.last30Minutes')}
              value={formatRecentUsage(summary.recent.last30Minutes, t)}
            />
            <QuotaMetaRow
              label={t('remote.quota.recent.lastHour')}
              value={formatRecentUsage(summary.recent.lastHour, t)}
            />
          </dl>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-4">
          <p className="text-sm font-medium text-[var(--color-foreground)]">{t('remote.quota.runtime.title')}</p>
          <dl className="mt-3 space-y-3 text-sm">
            <QuotaMetaRow
              label={t('remote.quota.runtime.activeConnections')}
              value={formatQuotaValue(summary.activeBrowserConnections)}
            />
            <QuotaMetaRow
              label={t('remote.quota.runtime.resetAt')}
              value={formatDateTime(locale, summary.day.resetsAt)}
            />
            <QuotaMetaRow
              label={t('remote.quota.runtime.costModel')}
              value={t('remote.quota.runtime.costModelValue', { version: summary.costModel.version })}
            />
            <QuotaMetaRow
              label={t('remote.quota.runtime.runawayGuard')}
              value={t('remote.quota.runtime.shadowOnly')}
            />
          </dl>
        </div>
      </div>
    </div>
  );
}

function DailyQuotaOverview(props: { summary: RemoteQuotaSummary; t: Translate }): JSX.Element {
  const resource = props.summary.day.limitingResource === 'worker_requests'
    ? props.summary.day.workerRequests
    : props.summary.day.durableObjectRequests;
  const actualPercent = resource.limit > 0 ? resource.actualUsed / resource.limit : 1;
  const reservedPercent = resource.limit > 0 ? resource.reserved / resource.limit : 0;
  const availablePercent = Math.max(0, 1 - actualPercent - reservedPercent);
  return (
    <div className="rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[0_10px_30px_rgba(55,47,34,0.05)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--color-foreground-muted)]">{props.t('remote.quota.overview.title')}</p>
          <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-foreground)]">
            {formatPercent(props.summary.day.utilization)}
          </p>
        </div>
        <p className="text-sm text-[var(--color-foreground-muted)]">
          {props.t('remote.quota.overview.remaining', { value: formatPercent(availablePercent) })}
        </p>
      </div>
      <div
        className="mt-4 flex h-3 overflow-hidden rounded-full bg-[var(--color-track)]"
        role="progressbar"
        aria-label={props.t('remote.quota.overview.title')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, props.summary.day.utilization * 100)}
      >
        <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, actualPercent * 100)}%` }} />
        <div className="h-full bg-emerald-300" style={{ width: `${Math.min(100, reservedPercent * 100)}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--color-foreground-muted)]">
        <span><span className="mr-2 inline-block size-2 rounded-full bg-emerald-600" />{props.t('remote.quota.actualUsed')}</span>
        <span><span className="mr-2 inline-block size-2 rounded-full bg-emerald-300" />{props.t('remote.quota.reserved')}</span>
        <span>{props.t(`remote.quota.overview.limiting.${props.summary.day.limitingResource}`)}</span>
      </div>
    </div>
  );
}

function QuotaResourceCard(props: {
  label: string;
  resource: RemoteQuotaResourceSummary;
  unitLabel: string;
  t: Translate;
}): JSX.Element {
  const committed = props.resource.actualUsed + props.resource.reserved;
  const utilization = props.resource.limit > 0 ? committed / props.resource.limit : 1;
  const barColor = utilization >= 1 ? 'bg-rose-500' : utilization >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--color-foreground)]">{props.label}</p>
        <span className="text-xs font-medium text-[var(--color-foreground-muted)]">{formatPercent(utilization)}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
        {formatQuotaValue(props.resource.actualUsed)}
        <span className="ml-2 text-sm font-medium text-[var(--color-foreground-muted)]">
          / {formatQuotaValue(props.resource.limit)} {props.unitLabel}
        </span>
      </p>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-track)]"
        role="progressbar"
        aria-label={props.label}
        aria-valuemin={0}
        aria-valuemax={props.resource.limit}
        aria-valuenow={Math.min(committed, props.resource.limit)}
      >
        <div className="flex h-full w-full">
          <div
            className={`h-full ${barColor}`}
            style={{ width: `${Math.min(100, props.resource.limit > 0 ? props.resource.actualUsed / props.resource.limit * 100 : 100)}%` }}
          />
          <div
            className="h-full bg-emerald-300"
            style={{ width: `${Math.min(100, props.resource.limit > 0 ? props.resource.reserved / props.resource.limit * 100 : 0)}%` }}
          />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--color-foreground-muted)]">
        <QuotaCompactMetric label={props.t('remote.quota.actualUsed')} value={props.resource.actualUsed} />
        <QuotaCompactMetric label={props.t('remote.quota.reserved')} value={props.resource.reserved} />
        <QuotaCompactMetric label={props.t('remote.quota.remainingLabel')} value={props.resource.remaining} />
      </dl>
    </div>
  );
}

function QuotaCompactMetric(props: { label: string; value: number }): JSX.Element {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd className="mt-1 font-semibold text-[var(--color-foreground)]">{formatQuotaValue(props.value)}</dd>
    </div>
  );
}

function QuotaStatusBadge(props: { status: RemoteQuotaSummary['day']['status']; t: Translate }): JSX.Element {
  const style = props.status === 'exhausted'
    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
    : props.status === 'near_limit'
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
      {props.t(`remote.quota.status.${props.status}`)}
    </span>
  );
}

function QuotaMetaRow(props: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[var(--color-foreground-muted)]">{props.label}</dt>
      <dd className="text-right font-medium text-[var(--color-foreground)]">{props.value}</dd>
    </div>
  );
}

function formatRecentUsage(usage: RemoteQuotaSummary['recent']['lastHour'], t: Translate): string {
  return t('remote.quota.recent.value', {
    worker: formatQuotaValue(usage.workerRequests),
    durableObject: formatQuotaValue(usage.durableObjectRequests)
  });
}

function formatQuotaValue(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 1
  }).format(value);
}

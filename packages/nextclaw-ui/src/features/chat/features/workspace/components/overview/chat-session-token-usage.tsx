import { ChartNoAxesColumn } from 'lucide-react';

import { useNcpSessionTokenUsage } from '@/features/chat/features/ncp/hooks/use-ncp-session-queries';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

function formatTokenCount(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat().format(value);
}

function formatCount(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat().format(value);
}

function formatCacheHitRate(value: number | null): string {
  return value === null
    ? '—'
    : new Intl.NumberFormat(undefined, {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(value);
}

function TokenUsageStatusBadge({ status }: { status: 'reported' | 'partial' | 'unavailable' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
        status === 'reported'
          ? 'bg-emerald-50 text-emerald-700'
          : status === 'partial'
            ? 'bg-amber-50 text-amber-700'
            : 'bg-gray-100 text-gray-500',
      )}
    >
      {t(
        status === 'reported'
          ? 'chatWorkspaceTokenUsageReported'
          : status === 'partial'
            ? 'chatWorkspaceTokenUsagePartial'
            : 'chatWorkspaceTokenUsageUnavailable',
      )}
    </span>
  );
}

function TokenUsageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-gray-50 px-2.5 py-2">
      <div className="truncate text-[10px] font-medium text-gray-500">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums text-gray-900">
        {value}
      </div>
    </div>
  );
}

export function ChatSessionTokenUsage({ sessionKey }: { sessionKey: string | null }) {
  const usageQuery = useNcpSessionTokenUsage(sessionKey);
  const usage = usageQuery.data;

  return (
    <section
      aria-labelledby="chat-workspace-token-usage-title"
      className="mt-4 rounded-lg border border-gray-200/80 bg-white p-3"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
          <ChartNoAxesColumn className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 id="chat-workspace-token-usage-title" className="text-sm font-semibold text-gray-900">
              {t('chatWorkspaceTokenUsage')}
            </h3>
            {usage ? <TokenUsageStatusBadge status={usage.status} /> : null}
          </div>
          <p className="mt-0.5 text-xs leading-5 text-gray-500">
            {t('chatWorkspaceTokenUsageDescription')}
          </p>
        </div>
      </div>

      {usageQuery.isLoading ? (
        <p className="py-5 text-center text-xs text-gray-500" aria-live="polite">
          {t('chatWorkspaceTokenUsageLoading')}
        </p>
      ) : usageQuery.isError ? (
        <div className="flex items-center justify-between gap-3 py-4 text-xs text-rose-600" role="alert">
          <span>{t('chatWorkspaceTokenUsageLoadFailed')}</span>
          <button
            type="button"
            className="shrink-0 rounded px-1.5 py-1 font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
            onClick={() => void usageQuery.refetch()}
          >
            {t('chatWorkspaceTokenUsageRetry')}
          </button>
        </div>
      ) : usage && usage.runCount > 0 ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            <TokenUsageMetric
              label={t('chatWorkspaceTokenUsageTotal')}
              value={formatTokenCount(usage.totals.totalTokens)}
            />
            <TokenUsageMetric
              label={t('chatWorkspaceTokenUsageInput')}
              value={formatTokenCount(usage.totals.inputTokens)}
            />
            <TokenUsageMetric
              label={t('chatWorkspaceTokenUsageOutput')}
              value={formatTokenCount(usage.totals.outputTokens)}
            />
            <TokenUsageMetric
              label={t('chatWorkspaceTokenUsageCachedInput')}
              value={formatTokenCount(usage.totals.cachedInputTokens)}
            />
            <TokenUsageMetric
              label={t('chatWorkspaceTokenUsageCacheHitRate')}
              value={formatCacheHitRate(usage.totals.cacheHitRate)}
            />
            <TokenUsageMetric
              label={t('chatWorkspaceTokenUsageRuns')}
              value={String(usage.runCount)}
            />
            <TokenUsageMetric
              label={t('chatWorkspaceTokenUsageModelCalls')}
              value={formatCount(usage.modelCallCount)}
            />
            <TokenUsageMetric
              label={t('chatWorkspaceTokenUsageReportedModelCalls')}
              value={formatCount(usage.reportedModelCallCount)}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-gray-700">
              {t('chatWorkspaceTokenUsageByModel')}
            </div>
            <div className="space-y-1.5">
              {usage.models.map((modelUsage) => (
                <div key={modelUsage.model} className="rounded-md border border-gray-200/70 px-2.5 py-2">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs font-semibold text-gray-900" title={modelUsage.model}>
                      {modelUsage.model}
                    </span>
                    <TokenUsageStatusBadge status={modelUsage.status} />
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500">
                    {t('chatWorkspaceTokenUsageModelRunCount').replace('{count}', String(modelUsage.runCount))}
                    {' · '}
                    {t('chatWorkspaceTokenUsageModelCallCount').replace(
                      '{count}',
                      formatCount(modelUsage.modelCallCount),
                    )}
                    {' · '}
                    {t('chatWorkspaceTokenUsageModelCacheHitRate').replace(
                      '{rate}',
                      formatCacheHitRate(modelUsage.cacheHitRate),
                    )}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] sm:grid-cols-4">
                    {[
                      [t('chatWorkspaceTokenUsageInput'), modelUsage.inputTokens],
                      [t('chatWorkspaceTokenUsageOutput'), modelUsage.outputTokens],
                      [t('chatWorkspaceTokenUsageCachedInput'), modelUsage.cachedInputTokens],
                      [t('chatWorkspaceTokenUsageTotal'), modelUsage.totalTokens],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="flex min-w-0 items-center justify-between gap-1 sm:block">
                        <dt className="truncate text-gray-500">{label}</dt>
                        <dd className="shrink-0 font-semibold tabular-nums text-gray-800 sm:mt-0.5">
                          {formatTokenCount(value as number | null)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="py-5 text-center text-xs leading-5 text-gray-500">
          {t('chatWorkspaceTokenUsageEmpty')}
        </p>
      )}
    </section>
  );
}

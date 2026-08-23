import { AlertTriangle, Clock3, Eye, Inbox, Pause, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatDateTime, t } from '@/shared/lib/i18n';
import { useConfirmDialog } from '@/shared/hooks/use-confirm-dialog';
import {
  useNcpObservationAction,
  useNcpSessionObservations,
} from '@/features/chat/features/ncp/hooks/use-ncp-session-queries';
import type {
  NcpSessionObservationAction,
  NcpSessionObservationKind,
  NcpSessionObservationView,
} from '@/shared/lib/api';
import { cn } from '@/shared/lib/utils';

type AttentionGroup = NcpSessionObservationKind;

const statusTone: Record<NcpSessionObservationView['status'], string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  paused: 'border-amber-200 bg-amber-50 text-amber-700',
  degraded: 'border-orange-200 bg-orange-50 text-orange-700',
  expired: 'border-gray-200 bg-gray-100 text-gray-600',
  broken: 'border-rose-200 bg-rose-50 text-rose-700',
};

function replaceCount(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

function getStatusLabel(status: NcpSessionObservationView['status']): string {
  return t(`chatWorkspaceContinuousAttentionStatus${status[0].toUpperCase()}${status.slice(1)}`);
}

function getGroupLabel(kind: AttentionGroup): string {
  return t(kind === 'context' ? 'chatWorkspaceContinuousAttentionState' : 'chatWorkspaceContinuousAttentionEvents');
}

function ObservationRow({
  item,
  isPending,
  onAction,
}: {
  item: NcpSessionObservationView;
  isPending: boolean;
  onAction: (action: NcpSessionObservationAction) => void;
}) {
  const canToggle = item.status === 'active' || item.status === 'paused';
  const toggleAction = item.status === 'active' ? 'pause' : 'resume';
  const toggleLabel = toggleAction === 'pause'
    ? t('chatWorkspaceContinuousAttentionPause')
    : t('chatWorkspaceContinuousAttentionResume');

  return (
    <article className="rounded-xl border border-gray-200/80 bg-white p-3 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
          {item.kind === 'context' ? <Eye className="h-4 w-4" /> : <Inbox className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">{item.title}</h3>
            <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-medium', statusTone[item.status])}>
              {getStatusLabel(item.status)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-gray-400">{item.extensionId} · {getGroupLabel(item.kind)}</p>
          {item.description ? <p className="mt-2 text-xs leading-5 text-gray-600">{item.description}</p> : null}
          {item.statusReason ? (
            <p className="mt-2 flex gap-1.5 text-xs leading-5 text-orange-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{item.statusReason}</span>
            </p>
          ) : null}
          {item.safeConfigPreview ? (
            <p className="mt-2 rounded-md bg-gray-50 px-2 py-1.5 text-[11px] leading-5 text-gray-500">
              {item.safeConfigPreview}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
            <span>{t('chatWorkspaceContinuousAttentionCreated')}: {formatDateTime(item.createdAt)}</span>
            {item.expiresAt ? <span>{t('chatWorkspaceContinuousAttentionExpires')}: {formatDateTime(item.expiresAt)}</span> : null}
            {item.lastReadAt ? <span>{t('chatWorkspaceContinuousAttentionLastRead')}: {formatDateTime(item.lastReadAt)}</span> : null}
            {item.kind === 'events' ? (
              <>
                <span>{replaceCount(t('chatWorkspaceContinuousAttentionPending'), item.pendingCount ?? 0)}</span>
                {item.suppressedCount ? <span>{replaceCount(t('chatWorkspaceContinuousAttentionSuppressed'), item.suppressedCount)}</span> : null}
                {item.deliveryFailureCount ? <span className="text-rose-600">{replaceCount(t('chatWorkspaceContinuousAttentionFailures'), item.deliveryFailureCount)}</span> : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-gray-100 pt-2">
        {canToggle ? (
          <button
            type="button"
            data-testid={`observation-${item.id}-${toggleAction}`}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onAction(toggleAction)}
          >
            {toggleAction === 'pause' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isPending ? t('chatWorkspaceContinuousAttentionUpdating') : toggleLabel}
          </button>
        ) : null}
        <button
          type="button"
          data-testid={`observation-${item.id}-remove`}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onAction('remove')}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('chatWorkspaceContinuousAttentionRemove')}
        </button>
      </div>
    </article>
  );
}

export function ChatSessionContinuousAttention({ sessionKey }: { sessionKey: string | null }) {
  const [activeGroup, setActiveGroup] = useState<AttentionGroup>('context');
  const [actionError, setActionError] = useState(false);
  const query = useNcpSessionObservations(sessionKey);
  const action = useNcpObservationAction(sessionKey);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  if (!sessionKey) return null;

  const view = query.data;
  const items = activeGroup === 'context' ? (view?.bindings ?? []) : (view?.subscriptions ?? []);
  const runAction = async (item: NcpSessionObservationView, nextAction: NcpSessionObservationAction) => {
    if (nextAction === 'remove') {
      const confirmed = await confirm({
        title: t('chatWorkspaceContinuousAttentionRemoveTitle'),
        description: t('chatWorkspaceContinuousAttentionRemoveDescription'),
        confirmLabel: t('chatWorkspaceContinuousAttentionRemove'),
        variant: 'destructive',
      });
      if (!confirmed) return;
    }
    setActionError(false);
    try {
      await action.mutateAsync({ kind: item.kind, id: item.id, action: nextAction });
    } catch {
      setActionError(true);
    }
  };

  return (
    <div className="h-full overflow-auto bg-gray-50/45 px-4 py-5 custom-scrollbar">
      <div className="mx-auto max-w-xl">
        <ConfirmDialog />
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Eye className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">{t('chatWorkspaceContinuousAttention')}</h2>
            <p className="mt-1 break-all text-xs leading-5 text-gray-500">{t('chatWorkspaceContinuousAttentionDescription')} · {sessionKey}</p>
          </div>
        </div>

        {view ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard label={t('chatWorkspaceContinuousAttentionTotal')} value={view.counts.total} />
            <SummaryCard label={t('chatWorkspaceContinuousAttentionState')} value={view.counts.context} />
            <SummaryCard label={t('chatWorkspaceContinuousAttentionEvents')} value={view.counts.events} />
            <SummaryCard label={t('chatWorkspaceContinuousAttentionNeedsAttention')} value={view.counts.needsAttention} />
          </div>
        ) : null}

        <div className="mt-4 flex rounded-lg border border-gray-200 bg-white p-1" role="tablist">
          {(['context', 'events'] as const).map((group) => {
            const count = group === 'context' ? (view?.counts.context ?? 0) : (view?.counts.events ?? 0);
            return (
              <button
                key={group}
                type="button"
                role="tab"
                aria-selected={activeGroup === group}
                className={cn('flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors', activeGroup === group ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700')}
                onClick={() => setActiveGroup(group)}
              >
                {getGroupLabel(group)} <span className="ml-1 tabular-nums text-gray-400">{count}</span>
              </button>
            );
          })}
        </div>
        {actionError ? <p className="mt-2 text-xs text-rose-600">{t('chatWorkspaceContinuousAttentionActionFailed')}</p> : null}

        {query.isPending ? (
          <div className="mt-3 space-y-2" aria-label={t('chatWorkspaceContinuousAttentionLoading')}>
            {[0, 1].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />)}
          </div>
        ) : query.isError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 text-center">
            <p className="text-sm font-medium text-rose-800">{t('chatWorkspaceContinuousAttentionLoadFailed')}</p>
            <button type="button" className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700" onClick={() => void query.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
              {t('chatWorkspaceContinuousAttentionRetry')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
            <Clock3 className="mx-auto h-5 w-5 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-700">{t('chatWorkspaceContinuousAttentionEmpty')}</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">{t('chatWorkspaceContinuousAttentionEmptyDescription')}</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <ObservationRow
                key={`${item.kind}:${item.id}`}
                item={item}
                isPending={action.isPending && action.variables?.id === item.id}
                onAction={(nextAction) => void runAction(item, nextAction)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200/80 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{value}</div>
    </div>
  );
}

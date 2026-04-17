import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRuntimeControl } from '@/hooks/use-runtime-control';
import { runtimeControlManager } from '@/runtime-control/runtime-control.manager';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type RuntimeStatusTone = 'healthy' | 'attention' | 'inactive';

const runtimeStatusToneStyles: Record<RuntimeStatusTone, string> = {
  healthy: 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]',
  attention: 'bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.16)]',
  inactive: 'bg-gray-300 shadow-[0_0_0_3px_rgba(156,163,175,0.12)]'
};

type RuntimeStatusSummary = {
  actionLabel: string | null;
  description: string;
  reasonLines: string[];
  title: string;
  tone: RuntimeStatusTone;
};

function buildRuntimeStatusSummary(
  view: ReturnType<typeof useRuntimeControl>['data']
): RuntimeStatusSummary {
  if (!view) {
    return {
      tone: 'inactive',
      title: t('runtimeStatusLoadingTitle'),
      description: t('runtimeStatusLoadingDescription'),
      reasonLines: [],
      actionLabel: null
    };
  }

  if (view.pendingRestart) {
    return {
      tone: 'attention',
      title: t('runtimeStatusPendingRestartTitle'),
      description: t('runtimeStatusPendingRestartDescription'),
      reasonLines:
        view.pendingRestart.changedPaths.length > 0
          ? view.pendingRestart.changedPaths.map((path) =>
              t('runtimeStatusPendingRestartReasonItem').replace('{path}', path)
            )
          : [view.pendingRestart.message],
      actionLabel: view.canRestartService.available ? t('runtimeStatusRestartAction') : null
    };
  }

  return {
    tone: view.lifecycle === 'healthy' ? 'healthy' : 'inactive',
    title: t('runtimeStatusHealthyTitle'),
    description: t('runtimeStatusHealthyDescription'),
    reasonLines: [],
    actionLabel: null
  };
}

export function RuntimeStatusEntry() {
  const queryClient = useQueryClient();
  const runtimeControlQuery = useRuntimeControl();
  const [isRestarting, setIsRestarting] = useState(false);
  const runtimeView = runtimeControlQuery.data;
  const summary = buildRuntimeStatusSummary(runtimeView);
  const title = runtimeControlQuery.isError ? t('runtimeControlLoadFailed') : summary.title;
  const description =
    runtimeControlQuery.isError && runtimeControlQuery.error instanceof Error
      ? runtimeControlQuery.error.message
      : summary.description;
  const canRestart = Boolean(runtimeView?.pendingRestart && runtimeView.canRestartService.available);

  const handleRestart = async () => {
    if (!canRestart) {
      return;
    }
    setIsRestarting(true);
    try {
      const result = await runtimeControlManager.controlService('restart-service');
      toast.success(result.message);
      await queryClient.invalidateQueries({ queryKey: ['runtime-control'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('runtimeControlActionFailed');
      toast.error(`${t('runtimeControlActionFailed')}: ${message}`);
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-0.5 transition-transform hover:scale-105"
          aria-label={title}
          title={title}
          data-testid="runtime-status-entry"
        >
          <span className={cn('h-2.5 w-2.5 rounded-full', runtimeStatusToneStyles[summary.tone])} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="w-[290px] space-y-3 rounded-2xl border border-gray-200 bg-white p-4"
      >
        <div className="space-y-1">
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <p className="text-xs leading-5 text-gray-600">{description}</p>
        </div>
        {summary.reasonLines.length > 0 ? (
          <div className="space-y-2">
            {summary.reasonLines.map((reason) => (
              <div
                key={reason}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
              >
                {reason}
              </div>
            ))}
          </div>
        ) : null}
        {summary.actionLabel ? (
          <div className="flex items-center justify-between border-t border-gray-100 pt-1">
            <span className="text-[11px] text-gray-500">{t('runtimeStatusActionHint')}</span>
            <button
              type="button"
              onClick={() => void handleRestart()}
              disabled={isRestarting}
              className="text-sm font-semibold text-sky-600 transition-colors hover:text-sky-700 disabled:text-gray-400"
            >
              {isRestarting ? t('runtimeStatusRestartingAction') : summary.actionLabel}
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

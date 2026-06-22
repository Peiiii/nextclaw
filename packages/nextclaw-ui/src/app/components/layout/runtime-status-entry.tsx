import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import {
  systemStatusManager,
  useRuntimeStatusBadgeView,
} from '@/features/system-status';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

type RuntimeStatusTone = 'healthy' | 'attention' | 'inactive';

const runtimeStatusToneStyles: Record<RuntimeStatusTone, string> = {
  healthy: 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]',
  attention: 'bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.16)]',
  inactive: 'bg-muted-foreground/45 shadow-[0_0_0_3px_rgba(156,163,175,0.12)]'
};

type RuntimeStatusSummary = {
  actionLabel: string | null;
  description: string;
  reasonLines: string[];
  title: string;
  tone: RuntimeStatusTone;
  isBusy: boolean;
};

export function RuntimeStatusEntry() {
  const summary = useRuntimeStatusBadgeView() as RuntimeStatusSummary;
  const canRestart = summary.actionLabel === t('runtimeStatusRestartAction');

  const handleStatusEntryClick = () => {
    if (summary.tone === 'healthy') {
      return;
    }
    systemStatusManager.requestRuntimeBootstrapProbeNow();
  };

  const handleRestart = async () => {
    if (!canRestart) {
      return;
    }
    try {
      const result =
        await systemStatusManager.runRuntimeControlAction('restart-service');
      toast.success(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('runtimeControlActionFailed');
      toast.error(`${t('runtimeControlActionFailed')}: ${message}`);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-0.5 transition-transform hover:scale-105"
          aria-label={summary.title}
          title={summary.title}
          data-testid="runtime-status-entry"
          onClick={handleStatusEntryClick}
        >
          <span className={cn('h-2.5 w-2.5 rounded-full', runtimeStatusToneStyles[summary.tone])} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="w-[290px] space-y-3 rounded-2xl border border-border bg-popover p-4 text-popover-foreground"
      >
        <div className="space-y-1">
          <div className="text-sm font-semibold text-foreground">{summary.title}</div>
          <p className="text-xs leading-5 text-muted-foreground">{summary.description}</p>
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
          <div className="flex items-center justify-between border-t border-border/70 pt-1">
            <span className="text-[11px] text-muted-foreground">{t('runtimeStatusActionHint')}</span>
            <button
              type="button"
              onClick={() => void handleRestart()}
              disabled={summary.isBusy}
              className="text-sm font-semibold text-primary transition-colors hover:text-primary-hover disabled:text-muted-foreground/45"
            >
              {summary.isBusy ? t('runtimeStatusRestartingAction') : summary.actionLabel}
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

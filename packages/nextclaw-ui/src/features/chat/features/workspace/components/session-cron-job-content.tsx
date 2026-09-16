import { ACTION_FEEDBACK, ACTION_MENU_ITEM_CLASS } from '@/shared/components/ui/actions/action-feedback';
import { Trash2 } from 'lucide-react';
import { useState } from "react";
import {
  CalendarClock,
  Check,
  Clock,
  MoreVertical,
  Play,
  TriangleAlert,
} from "lucide-react";

import {
  useCronJobActions,
} from "@/features/cron";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { useNavigate } from "react-router-dom";
import { pageResourceFromSystemObject } from "@/features/right-panel-resources";
import type { CronJobView } from "@/shared/lib/api";
import { Button } from "@/shared/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Switch } from "@/shared/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
  describeCronSchedule,
  formatRelativeTime,
} from "@/shared/lib/cron";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

function CronJobStatus({ job }: { readonly job: CronJobView }) {
  const needsAttention = job.state.lastStatus === "error";
  const label = needsAttention
    ? t("cronNeedsAttention")
    : job.enabled
      ? t("cronRunningNormally")
      : t("cronPaused");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        needsAttention
          ? "bg-red-50 text-red-700"
          : job.enabled
            ? "bg-emerald-50 text-emerald-700"
            : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          needsAttention
            ? "bg-red-500"
            : job.enabled
              ? "bg-emerald-500"
              : "bg-muted-foreground/50",
        )}
      />
      {label}
    </span>
  );
}

function SessionCronJobCard({
  cronActions,
  job,
  onOpenDetails,
}: {
  readonly cronActions: ReturnType<typeof useCronJobActions>;
  readonly job: CronJobView;
  readonly onOpenDetails: (job: CronJobView) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isPending = cronActions.isPending(job);
  const needsAttention = job.state.lastStatus === "error";
  const StatusIcon = needsAttention ? TriangleAlert : Check;
  const jobLabel = job.name || job.id;

  return (
    <article className="rounded-2xl border border-border/60 bg-background px-3.5 py-3 shadow-sm transition-colors hover:bg-[var(--interaction-hover)] focus-within:bg-[var(--interaction-hover)]">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            needsAttention
              ? "bg-amber-50 text-amber-600"
              : job.enabled
                ? "bg-emerald-50 text-emerald-600"
                : "bg-muted text-muted-foreground",
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {jobLabel}
            </h3>
            <CronJobStatus job={job} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {describeCronSchedule(job)}
            </span>
            {job.enabled && job.state.nextRunAt ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {t("cronNextRun")} {formatRelativeTime(job.state.nextRunAt)}
              </span>
            ) : null}
          </div>
        </div>
        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Switch
                  checked={job.enabled}
                  disabled={isPending}
                  onCheckedChange={(enabled) => {
                    void cronActions.toggleJob(job, enabled);
                  }}
                  aria-label={job.enabled ? t("cronDisable") : t("cronEnable")}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {job.enabled ? t("cronDisable") : t("cronEnable")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {job.payload.message}
      </p>
      {!job.enabled ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("cronToggleHint")}
        </p>
      ) : null}
      {job.state.lastError ? (
        <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-red-700">
          {job.state.lastError}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onOpenDetails(job)}
        >
          {t("cronEditDetails")}
        </Button>
        <TooltipProvider delayDuration={250}>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={isPending}
                    aria-label={`${t("cronMoreActions")} ${jobLabel}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("cronMoreActions")}</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" sideOffset={4} variant="menu">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setMenuOpen(false);
                  void cronActions.runJob(job);
                }}
                className={`${ACTION_MENU_ITEM_CLASS} text-foreground ${ACTION_FEEDBACK.item}`}
              >
                <Play className="h-4 w-4 shrink-0 text-muted-foreground" />
                {t("cronRunNow")}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setMenuOpen(false);
                  void cronActions.deleteJob(job);
                }}
                className={`${ACTION_MENU_ITEM_CLASS} ${ACTION_FEEDBACK.destructive}`}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                {t("delete")}
              </button>
            </PopoverContent>
          </Popover>
        </TooltipProvider>
      </div>
    </article>
  );
}

export function SessionCronJobContent({
  jobs,
  isError = false,
  isLoading = false,
  onRetry,
}: {
  readonly jobs: readonly CronJobView[];
  readonly isError?: boolean;
  readonly isLoading?: boolean;
  readonly onRetry?: () => void;
}) {
  const app = useAppPresenter();
  const navigate = useNavigate();
  const cronActions = useCronJobActions();

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 py-4">
      <div className="mb-4">
        <div className="text-sm font-semibold text-foreground">
          {t("chatWorkspaceSessionCronJobs")}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {t("cronTotalLabel")}: {jobs.length}
        </div>
      </div>
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t("cronLoading")}
        </div>
      ) : isError ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <p>{t("cronLoadFailed")}</p>
          {onRetry ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={onRetry}
            >
              {t("cronRetry")}
            </Button>
          ) : null}
        </div>
      ) : jobs.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t("chatWorkspaceCronJobEmpty")}
        </div>
      ) : (
        <div className="space-y-2.5">
          {jobs.map((job) => (
            <SessionCronJobCard
              key={job.id}
              cronActions={cronActions}
              job={job}
              onOpenDetails={(item) => app.pageResourceManager.open(pageResourceFromSystemObject("cron-job", item.id, item.name || item.id), "default", navigate)}
            />
          ))}
        </div>
      )}
      <cronActions.ConfirmDialog />
    </div>
  );
}

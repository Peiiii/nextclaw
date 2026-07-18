import { useState } from "react";
import {
  CalendarClock,
  Check,
  Clock,
  MoreVertical,
  Pencil,
  Play,
  Trash2,
  TriangleAlert,
} from "lucide-react";

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
  describeCronSession,
  formatCronDate,
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
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
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

type CronJobRowProps = {
  readonly expanded: boolean;
  readonly job: CronJobView;
  readonly onDelete: (job: CronJobView) => void;
  readonly onEdit: (job: CronJobView) => void;
  readonly onRun: (job: CronJobView) => void;
  readonly onToggleExpanded: (job: CronJobView) => void;
  readonly onToggle: (job: CronJobView, enabled: boolean) => void;
};

export function CronJobRow({
  expanded,
  job,
  onDelete,
  onEdit,
  onRun,
  onToggleExpanded,
  onToggle,
}: CronJobRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isBound = Boolean(job.payload.sessionId?.trim());
  const needsAttention = job.state.lastStatus === "error";
  const StatusIcon = needsAttention ? TriangleAlert : Check;
  const jobLabel = job.name || job.id;
  const previewId = `cron-job-preview-${job.id}`;

  return (
    <div
      className={cn(
        "group relative rounded-xl border-b border-border/55 transition-colors duration-150 last:border-b-0 hover:bg-muted/35 focus-within:bg-muted/35",
        expanded && "bg-muted/35",
      )}
    >
      <div className="flex items-center gap-3 px-1 py-3.5">
        <button
          type="button"
          className="grid min-w-0 flex-1 grid-cols-[36px_minmax(0,1fr)] items-center gap-3 rounded-lg pr-16 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
          aria-controls={previewId}
          aria-expanded={expanded}
          aria-label={`${t(expanded ? "cronCollapseTask" : "cronExpandTask")} ${jobLabel}`}
          onClick={() => onToggleExpanded(job)}
        >
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl",
              needsAttention
                ? "bg-amber-50 text-amber-600"
                : "bg-emerald-50 text-emerald-600",
            )}
          >
            <StatusIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <strong className="truncate text-[13px] font-semibold text-foreground">
                {jobLabel}
              </strong>
              <CronJobStatus job={job} />
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {isBound ? t("cronBoundSession") : t("cronDedicatedSession")}
              </span>
              {job.deleteAfterRun ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {t("cronOneShot")}
                </span>
              ) : null}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                {describeCronSchedule(job)}
              </span>
              {job.state.nextRunAt ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("cronNextRun")} {formatRelativeTime(job.state.nextRunAt)}
                </span>
              ) : null}
            </span>
          </span>
        </button>

        <TooltipProvider delayDuration={250}>
          <div className="relative flex shrink-0 items-center">
            <div className="absolute right-11 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-100 transition-opacity duration-150 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:pointer-events-auto [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(job)}
                    aria-label={`${t("edit")} ${jobLabel}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("cronEditDetails")}</TooltipContent>
              </Tooltip>

              <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`${t("cronMoreActions")} ${jobLabel}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{t("cronMoreActions")}</TooltipContent>
                </Tooltip>
                <PopoverContent align="end" sideOffset={4} className="w-40 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onRun(job);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                  >
                    <Play className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("cronRunNow")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(job);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("delete")}
                  </button>
                </PopoverContent>
              </Popover>
            </div>
            <Switch
              checked={job.enabled}
              onCheckedChange={(checked) => onToggle(job, checked)}
              aria-label={job.enabled ? t("cronDisable") : t("cronEnable")}
            />
          </div>
        </TooltipProvider>
      </div>

      <div
        id={previewId}
        aria-hidden={!expanded}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          expanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="mb-3 ml-12 mr-1 rounded-xl bg-background/70 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t("cronTaskPrompt")}
            </div>
            <p className="mt-1.5 line-clamp-4 text-xs leading-5 text-foreground">
              {job.payload.message}
            </p>
            <dl className="mt-3 grid gap-x-5 gap-y-2 border-t border-border/50 pt-3 text-[11px] sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-muted-foreground">{t("cronAgentLabel")}</dt>
                <dd className="mt-0.5 truncate font-medium text-foreground">
                  {job.payload.agentId?.trim() || "main"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">
                  {t("cronSessionLabel")}
                </dt>
                <dd className="mt-0.5 truncate font-medium text-foreground">
                  {describeCronSession(job)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">{t("cronLastRun")}</dt>
                <dd className="mt-0.5 truncate font-medium text-foreground">
                  {formatCronDate(job.state.lastRunAt)}
                </dd>
              </div>
            </dl>
            {job.state.lastError ? (
              <p className="mt-3 line-clamp-2 border-t border-red-100 pt-3 text-[11px] leading-5 text-red-700">
                {job.state.lastError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

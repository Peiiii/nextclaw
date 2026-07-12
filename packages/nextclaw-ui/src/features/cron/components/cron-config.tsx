import { useMemo, useState } from "react";
import type { CronJobView } from "@/shared/lib/api";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import {
  useCronJobs,
  useDeleteCronJob,
  useToggleCronJob,
  useRunCronJob,
} from "@/features/cron/hooks/use-cron-jobs";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
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
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import { PageLayout, PageHeader } from "@/app/components/layout/page-layout";
import {
  Search,
  RefreshCw,
  Trash2,
  Play,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Clock,
  CalendarClock,
  ListTodo,
  AlertCircle,
} from "lucide-react";

type StatusFilter = "all" | "enabled" | "disabled";

function matchQuery(job: CronJobView, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    job.id,
    job.name,
    job.payload.message,
    job.payload.sessionId ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function filterByStatus(job: CronJobView, status: StatusFilter): boolean {
  if (status === "all") return true;
  if (status === "enabled") return job.enabled;
  return !job.enabled;
}

function StatusBadge({ job }: { job: CronJobView }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        job.enabled
          ? "bg-emerald-50 text-emerald-700"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          job.enabled ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
      />
      {job.enabled ? t("enabled") : t("disabled")}
    </span>
  );
}

function CronJobCard(props: {
  job: CronJobView;
  onDelete: (job: CronJobView) => void;
  onRun: (job: CronJobView) => void;
  onToggle: (job: CronJobView, nextEnabled: boolean) => void;
}) {
  const { job, onDelete, onRun, onToggle } = props;
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-expand]")) return;
    setExpanded(!expanded);
  };

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-xl border border-border/70 bg-card transition-colors cursor-pointer",
        expanded ? "bg-muted/20" : "hover:bg-muted/30",
      )}
      onClick={handleCardClick}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
              )}
              <span className="text-sm font-medium text-foreground truncate">
                {job.name || job.id}
              </span>
              <StatusBadge job={job} />
              {job.deleteAfterRun ? (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {t("cronOneShot")}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0" data-no-expand>
            <Switch
              checked={job.enabled}
              onCheckedChange={(checked) => onToggle(job, checked)}
            />
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label={t("cronMoreActions")}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
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
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pl-6">
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3 w-3 text-muted-foreground/70" />
            <span className="font-mono text-foreground/80">
              {describeCronSchedule(job)}
            </span>
          </span>
          {job.state.nextRunAt ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground/70" />
              <span>{formatRelativeTime(job.state.nextRunAt)}</span>
            </span>
          ) : null}
          {job.state.lastRunAt ? (
            <span className="flex items-center gap-1" data-no-expand>
              <span className="text-border">•</span>
              {job.state.lastStatus === "error" && job.state.lastError ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-0.5 text-orange-500 cursor-help">
                        <AlertCircle className="h-3 w-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="start"
                      className="max-w-xs text-xs bg-red-50 text-red-700 border-red-200"
                    >
                      {job.state.lastError}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span
                  className={cn(
                    job.state.lastStatus === "ok"
                      ? "text-emerald-500"
                      : "text-muted-foreground/70",
                  )}
                >
                  {job.state.lastStatus === "ok" ? "✓" : ""}
                </span>
              )}
              <span>{formatRelativeTime(job.state.lastRunAt)}</span>
            </span>
          ) : null}
        </div>

        <div className="mt-2 pl-6">
          <div
            className={cn(
              "text-sm text-muted-foreground break-words",
              !expanded && "line-clamp-2",
            )}
          >
            {job.payload.message}
          </div>
        </div>

        {expanded ? (
          <div className="mt-3 ml-6 space-y-3 border-t border-border/60 pt-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
              <div>
                <div className="text-[11px] text-muted-foreground/70 mb-0.5">
                  {t("cronSessionLabel")}
                </div>
                <div
                  className="text-foreground/80 font-mono text-[11px] truncate"
                  title={describeCronSession(job)}
                >
                  {describeCronSession(job)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground/70 mb-0.5">
                  {t("cronNextRun")}
                </div>
                <div className="text-foreground/80">
                  {formatCronDate(job.state.nextRunAt)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground/70 mb-0.5">
                  {t("cronLastRun")}
                </div>
                <div className="text-foreground/80">
                  {formatCronDate(job.state.lastRunAt)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground/70 mb-0.5">
                  {t("cronLastStatus")}
                </div>
                <div
                  className={cn(
                    "inline-flex items-center gap-1 font-medium",
                    job.state.lastStatus === "ok"
                      ? "text-emerald-600"
                      : job.state.lastStatus === "error"
                        ? "text-red-600"
                        : job.state.lastStatus === "skipped"
                          ? "text-amber-600"
                          : "text-muted-foreground",
                  )}
                >
                  {job.state.lastStatus ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground/70 mb-0.5">
                  {t("cronCreatedAt")}
                </div>
                <div className="text-foreground/80">
                  {formatCronDate(job.createdAt)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground/70 mb-0.5">
                  {t("cronId")}
                </div>
                <div
                  className="text-foreground/80 font-mono text-[11px] truncate"
                  title={job.id}
                >
                  {job.id}
                </div>
              </div>
            </div>

            {job.state.lastError ? (
              <div className="rounded-lg bg-red-50/80 border border-red-100 px-3 py-2 text-xs text-red-600 break-words">
                {job.state.lastError}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CronConfig() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const cronQuery = useCronJobs({ all: true });
  const deleteCronJob = useDeleteCronJob();
  const toggleCronJob = useToggleCronJob();
  const runCronJob = useRunCronJob();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const jobs = useMemo(() => {
    const data = cronQuery.data?.jobs ?? [];
    return data
      .filter((job) => matchQuery(job, query))
      .filter((job) => filterByStatus(job, status));
  }, [cronQuery.data, query, status]);

  const handleDelete = async (job: CronJobView) => {
    const confirmed = await confirm({
      title: `${t("cronDeleteConfirm")}?`,
      description: job.name ? `${job.name} (${job.id})` : job.id,
      variant: "destructive",
      confirmLabel: t("delete"),
    });
    if (!confirmed) return;
    deleteCronJob.mutate({ id: job.id });
  };

  const handleToggle = (job: CronJobView, nextEnabled: boolean) => {
    toggleCronJob.mutate({ id: job.id, enabled: nextEnabled });
  };

  const handleRun = async (job: CronJobView) => {
    const force = !job.enabled;
    if (force) {
      const confirmed = await confirm({
        title: `${t("cronRunForceConfirm")}?`,
        description: job.name ? `${job.name} (${job.id})` : job.id,
        confirmLabel: t("cronRunNow"),
      });
      if (!confirmed) return;
    }
    runCronJob.mutate({ id: job.id, force });
  };

  return (
    <PageLayout fullHeight>
      <PageHeader
        title={t("cronPageTitle")}
        description={t("cronPageDescription")}
        actions={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => cronQuery.refetch()}
          >
            <RefreshCw
              className={cn("h-4 w-4", cronQuery.isFetching && "animate-spin")}
            />
          </Button>
        }
      />

      <div className="mb-4">
        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("cronSearchPlaceholder")}
              className="pl-9"
            />
          </div>
          <div className="min-w-[140px]">
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as StatusFilter)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("cronStatusLabel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("cronStatusAll")}</SelectItem>
                <SelectItem value="enabled">
                  {t("cronStatusEnabled")}
                </SelectItem>
                <SelectItem value="disabled">
                  {t("cronStatusDisabled")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground ml-auto tabular-nums">
            {jobs.length} / {cronQuery.data?.total ?? 0}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {cronQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mb-3" />
            <span className="text-sm">{t("cronLoading")}</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <ListTodo className="h-5 w-5 text-muted-foreground/70" />
            </div>
            <span className="text-sm font-medium text-foreground">
              {t("cronEmpty")}
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              {t("cronEmptyGuide")}
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <CronJobCard
                key={job.id}
                job={job}
                onDelete={handleDelete}
                onRun={handleRun}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog />
    </PageLayout>
  );
}

import { useDeferredValue, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ListTodo,
  RefreshCw,
  Search,
} from "lucide-react";

import { PageLayout } from "@/app/components/layout/page-layout";
import { usePresenter } from "@/features/chat";
import { CronJobDetailDialog } from "@/features/cron/components/cron-job-detail-dialog";
import { CronJobRow } from "@/features/cron/components/cron-job-row";
import {
  CronTaskComposer,
  CronTemplateGallery,
} from "@/features/cron/components/cron-task-discovery";
import {
  useCronJobs,
  useDeleteCronJob,
  useRunCronJob,
  useToggleCronJob,
} from "@/features/cron/hooks/use-cron-jobs";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import type {
  CronJobView,
  CronListStatus,
  CronListSummaryView,
} from "@/shared/lib/api";
import { describeCronSession } from "@/shared/lib/cron";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

const CRON_PAGE_SIZE = 10;

function CronSummaryStrip({
  summary,
}: {
  readonly summary: CronListSummaryView;
}) {
  const { attention, disabled, enabled, total } = summary;
  const metrics = [
    { label: t("cronSummaryTotal"), value: total },
    { label: t("cronSummaryEnabled"), value: enabled },
    { label: t("cronSummaryPaused"), value: disabled },
  ];
  const AttentionIcon = attention > 0 ? CircleAlert : CircleCheck;

  return (
    <section
      aria-label={t("cronSummaryLabel")}
      className="grid grid-cols-3 overflow-hidden rounded-2xl bg-border/60 sm:grid-cols-[minmax(220px,1.35fr)_repeat(3,minmax(100px,0.55fr))] sm:gap-px"
    >
      <div className="col-span-3 flex items-center gap-3 bg-muted/40 px-4 py-3.5 sm:col-span-1">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            attention > 0
              ? "bg-amber-50 text-amber-600"
              : "bg-emerald-50 text-emerald-600",
          )}
        >
          <AttentionIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-xs font-semibold text-foreground">
            {attention > 0
              ? `${attention} ${t("cronAttentionSummary")}`
              : t("cronAllHealthy")}
          </strong>
          <span className="mt-1 block truncate text-[11px] text-muted-foreground">
            {attention > 0
              ? t("cronAttentionSummaryHint")
              : t("cronAllHealthyHint")}
          </span>
        </span>
      </div>
      {metrics.map((metric) => (
        <div key={metric.label} className="bg-muted/40 px-4 py-3.5 sm:px-5">
          <div className="text-lg font-semibold tabular-nums text-foreground">
            {metric.value}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {metric.label}
          </div>
        </div>
      ))}
    </section>
  );
}

function CronPagination({
  page,
  total,
  disabled,
  onPageChange,
}: {
  readonly page: number;
  readonly total: number;
  readonly disabled: boolean;
  readonly onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / CRON_PAGE_SIZE);
  if (totalPages <= 1) {
    return null;
  }
  const rangeStart = page * CRON_PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, rangeStart + CRON_PAGE_SIZE - 1);

  return (
    <nav
      aria-label={t("cronPaginationLabel")}
      className="flex items-center justify-between gap-3 border-b border-border/60 py-3 text-xs text-muted-foreground"
    >
      <span className="tabular-nums">
        {rangeStart}–{rangeEnd} / {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled || page === 0}
          onClick={() => onPageChange(page - 1)}
          aria-label={t("cronPreviousPage")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-14 text-center tabular-nums text-foreground">
          {page + 1} / {totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled || page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          aria-label={t("cronNextPage")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

export function CronConfig() {
  const [composerPrompt, setComposerPrompt] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CronListStatus>("all");
  const [page, setPage] = useState(0);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim());
  const composerRef = useRef<HTMLInputElement>(null);
  const presenter = usePresenter();
  const cronQuery = useCronJobs({
    all: true,
    limit: CRON_PAGE_SIZE,
    offset: page * CRON_PAGE_SIZE,
    query: deferredQuery,
    status,
  });
  const deleteCronJob = useDeleteCronJob();
  const toggleCronJob = useToggleCronJob();
  const runCronJob = useRunCronJob();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const jobs = cronQuery.data?.jobs ?? [];
  const total = cronQuery.data?.total ?? 0;
  const summary = cronQuery.data?.summary;
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;

  const startDraftConversation = () => {
    const prompt = composerPrompt.trim();
    if (!prompt) {
      composerRef.current?.focus();
      return;
    }
    presenter.chatSessionListManager.createSession({ prompt });
  };

  const handleTemplateSelect = (prompt: string) => {
    setComposerPrompt(prompt);
    composerRef.current?.focus();
  };

  const handleDelete = async (job: CronJobView) => {
    const confirmed = await confirm({
      title: `${t("cronDeleteConfirm")}?`,
      description: job.name ? `${job.name} (${job.id})` : job.id,
      variant: "destructive",
      confirmLabel: t("delete"),
    });
    if (!confirmed) {
      return;
    }
    setExpandedJobId(null);
    setSelectedJobId(null);
    if (jobs.length === 1 && page > 0) {
      setPage(page - 1);
    }
    deleteCronJob.mutate({ id: job.id });
  };

  const handleToggle = (job: CronJobView, enabled: boolean) => {
    const leavesCurrentFilter =
      (status === "enabled" && !enabled) || (status === "disabled" && enabled);
    if (leavesCurrentFilter && jobs.length === 1 && page > 0) {
      setPage(page - 1);
    }
    toggleCronJob.mutate({ id: job.id, enabled });
  };

  const handleRun = async (job: CronJobView) => {
    const force = !job.enabled;
    if (force) {
      const confirmed = await confirm({
        title: `${t("cronRunForceConfirm")}?`,
        description: job.name ? `${job.name} (${job.id})` : job.id,
        confirmLabel: t("cronRunNow"),
      });
      if (!confirmed) {
        return;
      }
    }
    runCronJob.mutate({ id: job.id, force });
  };

  const handleOpenSession = (job: CronJobView) => {
    presenter.chatSessionListManager.selectSession(describeCronSession(job));
  };

  const handlePageChange = (nextPage: number) => {
    setExpandedJobId(null);
    setPage(nextPage);
  };

  const handleToggleExpanded = (job: CronJobView) => {
    setExpandedJobId((currentId) => (currentId === job.id ? null : job.id));
  };

  const hasTasks = (summary?.total ?? 0) > 0;

  return (
    <PageLayout className="space-y-7">
      <header className="flex items-start justify-between gap-6 pt-2">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            {t("cronWorkspaceEyebrow")}
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
            {t("cronPageTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("cronPageDescription")}
          </p>
        </div>
        <div className="pt-5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              if (page === 0) {
                setExpandedJobId(null);
                void cronQuery.refetch();
              } else {
                handlePageChange(0);
              }
            }}
            aria-label={t("refresh")}
          >
            <RefreshCw
              className={cn("h-4 w-4", cronQuery.isFetching && "animate-spin")}
            />
          </Button>
        </div>
      </header>

      {hasTasks ? (
        <CronTaskComposer
          ref={composerRef}
          value={composerPrompt}
          onChange={setComposerPrompt}
          onSubmit={startDraftConversation}
        />
      ) : null}

      {cronQuery.isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="mb-3 h-5 w-5 animate-spin" />
          <span className="text-sm">{t("cronLoading")}</span>
        </div>
      ) : hasTasks ? (
        <>
          {summary ? <CronSummaryStrip summary={summary} /> : null}

          <section className="pt-1">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {t("cronMyTasks")}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {total} {t("cronTaskCountUnit")}
                </p>
              </div>
            </div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    handlePageChange(0);
                  }}
                  placeholder={t("cronSearchPlaceholder")}
                  className="pl-9"
                />
              </div>
              <div
                className="flex flex-wrap items-center gap-1"
                aria-label={t("cronStatusLabel")}
              >
                {(
                  [
                    ["all", "cronStatusAll"],
                    ["enabled", "cronStatusEnabled"],
                    ["disabled", "cronStatusDisabled"],
                    ["attention", "cronStatusAttention"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={status === value}
                    onClick={() => {
                      setStatus(value);
                      handlePageChange(0);
                    }}
                    className={cn(
                      "rounded-lg px-2.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      status === value && "bg-muted text-foreground",
                    )}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>

            {jobs.length > 0 ? (
              <>
                <div
                  aria-busy={cronQuery.isFetching}
                  className={cn(
                    "border-y border-border/60 transition-opacity",
                    cronQuery.isFetching && "opacity-60",
                  )}
                >
                  {jobs.map((job) => (
                    <CronJobRow
                      key={job.id}
                      expanded={expandedJobId === job.id}
                      job={job}
                      onDelete={handleDelete}
                      onEdit={(item) => setSelectedJobId(item.id)}
                      onRun={handleRun}
                      onToggleExpanded={handleToggleExpanded}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
                <CronPagination
                  page={page}
                  total={total}
                  disabled={cronQuery.isFetching}
                  onPageChange={handlePageChange}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Search className="mb-3 h-5 w-5" />
                <span className="text-sm font-medium text-foreground">
                  {t("cronNoMatchingTasks")}
                </span>
                <span className="mt-1 text-xs">
                  {t("cronNoMatchingTasksHint")}
                </span>
              </div>
            )}
          </section>

          <section className="pt-2">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-foreground">
                {t("cronNeedInspiration")}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("cronTemplateSelectionHint")}
              </p>
            </div>
            <CronTemplateGallery compact onSelect={handleTemplateSelect} />
          </section>
        </>
      ) : (
        <>
          <section className="flex min-h-[270px] flex-col items-center justify-center rounded-3xl bg-muted/25 px-4 py-10 text-center sm:px-8">
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-card shadow-sm">
              <ListTodo className="h-5 w-5 text-primary" />
            </span>
            <h2 className="text-xl font-semibold text-foreground">
              {t("cronEmptyHeroTitle")}
            </h2>
            <p className="mb-6 mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("cronEmptyHeroDescription")}
            </p>
            <CronTaskComposer
              ref={composerRef}
              prominent
              value={composerPrompt}
              onChange={setComposerPrompt}
              onSubmit={startDraftConversation}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              {t("cronComposerHint")}
            </p>
          </section>
          <section>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-foreground">
                {t("cronStartFromResult")}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("cronTemplateSelectionHint")}
              </p>
            </div>
            <CronTemplateGallery onSelect={handleTemplateSelect} />
          </section>
        </>
      )}

      <CronJobDetailDialog
        job={selectedJob}
        open={Boolean(selectedJob)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJobId(null);
          }
        }}
        onDelete={handleDelete}
        onOpenSession={handleOpenSession}
        onRun={handleRun}
        onToggle={handleToggle}
      />
      <ConfirmDialog />
    </PageLayout>
  );
}

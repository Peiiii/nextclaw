import { ExternalLink, Play, Trash2 } from "lucide-react";

import type { CronJobView } from "@/shared/lib/api";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/overlays/sheet";
import { Switch } from "@/shared/components/ui/switch";
import {
  describeCronSchedule,
  describeCronSession,
  formatCronDate,
} from "@/shared/lib/cron";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

function DetailRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-3 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[65%] break-words text-right text-xs font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

type CronJobDetailDialogProps = {
  readonly job: CronJobView | null;
  readonly open: boolean;
  readonly onDelete: (job: CronJobView) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onOpenSession: (job: CronJobView) => void;
  readonly onRun: (job: CronJobView) => void;
  readonly onToggle: (job: CronJobView, enabled: boolean) => void;
};

export function CronJobDetailDialog({
  job,
  open,
  onDelete,
  onOpenChange,
  onOpenSession,
  onRun,
  onToggle,
}: CronJobDetailDialogProps) {
  if (!job) {
    return null;
  }

  const sessionKey = describeCronSession(job);
  const isBound = Boolean(job.payload.sessionId?.trim());
  const canOpenSession = isBound || Boolean(job.state.lastRunAt);
  const status = job.state.lastStatus
    ? t(
        `cronLastStatus${job.state.lastStatus[0].toUpperCase()}${job.state.lastStatus.slice(1)}`,
      )
    : t("cronNeverRun");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={t("cronCloseDetails")}
        className="flex w-full flex-col overflow-hidden p-0 sm:max-w-[510px]"
      >
        <SheetHeader className="shrink-0 border-b border-border/60 px-5 pb-5 pt-6 pr-14 sm:px-7 sm:pt-7">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{describeCronSchedule(job)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {isBound ? t("cronBoundSession") : t("cronDedicatedSession")}
            </span>
          </div>
          <SheetTitle>{job.name || job.id}</SheetTitle>
          <SheetDescription>{t("cronDetailDescription")}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-7">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("cronTaskPrompt")}
            </h3>
            <div className="rounded-2xl bg-muted/55 px-4 py-3 text-sm leading-6 text-foreground">
              {job.payload.message}
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("cronTaskDetails")}
            </h3>
            <div>
              <DetailRow
                label={t("cronScheduleLabel")}
                value={describeCronSchedule(job)}
              />
              <DetailRow
                label={t("cronNextRun")}
                value={formatCronDate(job.state.nextRunAt)}
              />
              <DetailRow
                label={t("cronAgentLabel")}
                value={job.payload.agentId?.trim() || "main"}
              />
              <DetailRow label={t("cronSessionLabel")} value={sessionKey} />
              <DetailRow
                label={t("cronCreatedAt")}
                value={formatCronDate(job.createdAt)}
              />
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("cronLatestRun")}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("cronLatestRunHint")}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  job.state.lastStatus === "error"
                    ? "bg-red-50 text-red-700"
                    : job.state.lastStatus === "ok"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {status}
              </span>
            </div>
            <div className="rounded-2xl border border-border/60 px-4 py-1">
              <DetailRow
                label={t("cronLastRun")}
                value={formatCronDate(job.state.lastRunAt)}
              />
              {job.state.lastError ? (
                <DetailRow
                  label={t("cronLastError")}
                  value={job.state.lastError}
                />
              ) : null}
            </div>
          </section>

          <section className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-foreground">
                {job.enabled ? t("cronEnabledState") : t("cronPaused")}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t("cronToggleHint")}
              </div>
            </div>
            <Switch
              checked={job.enabled}
              onCheckedChange={(checked) => onToggle(job, checked)}
              aria-label={job.enabled ? t("cronDisable") : t("cronEnable")}
            />
          </section>

          {!canOpenSession ? (
            <p className="text-xs text-muted-foreground">
              {t("cronSessionAvailableAfterRun")}
            </p>
          ) : null}
        </div>

        <SheetFooter className="shrink-0 border-t border-border/60 bg-background px-5 py-4 sm:px-7">
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => onDelete(job)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("delete")}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenSession(job)}
            disabled={!canOpenSession}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {t("cronOpenSession")}
          </Button>
          <Button onClick={() => onRun(job)}>
            <Play className="mr-2 h-4 w-4" />
            {t("cronRunNow")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

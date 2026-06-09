import { Trash2 } from "lucide-react";
import type { CronJobView } from "@/shared/lib/api";
import { Button } from "@/shared/components/ui/button";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import { useDeleteCronJob } from "@/features/cron";
import {
  describeCronSchedule,
  describeCronSession,
  formatCronDate,
} from "@/shared/lib/cron";
import { t } from "@/shared/lib/i18n";

export function SessionCronJobContent({ jobs }: { jobs: readonly CronJobView[] }) {
  const deleteCronJob = useDeleteCronJob();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const handleDelete = async (job: CronJobView) => {
    const confirmed = await confirm({
      title: `${t("cronDeleteConfirm")}?`,
      description: job.name ? `${job.name} (${job.id})` : job.id,
      confirmLabel: t("delete"),
    });
    if (!confirmed) {
      return;
    }
    deleteCronJob.mutate({ id: job.id });
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 py-4">
      <div className="mb-4">
        <div className="text-sm font-semibold text-gray-900">
          {t("chatWorkspaceSessionCronJobs")}
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {t("cronTotalLabel")}: {jobs.length}
        </div>
      </div>
      {jobs.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          {t("chatWorkspaceCronJobEmpty")}
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-lg border border-gray-200 bg-white px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">
                    {job.name || job.id}
                  </div>
                  <div className="mt-1 text-[11px] text-gray-400">
                    {job.id}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="subtle"
                  size="sm"
                  className="h-7 gap-1 rounded-lg px-2"
                  onClick={() => void handleDelete(job)}
                  disabled={deleteCronJob.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("delete")}
                </Button>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-gray-500">
                <div>
                  <span className="font-medium text-gray-700">{t("cronScheduleLabel")}:</span>{" "}
                  {describeCronSchedule(job)}
                </div>
                <div>
                  <span className="font-medium text-gray-700">{t("cronNextRun")}:</span>{" "}
                  {formatCronDate(job.state.nextRunAt)}
                </div>
                <div>
                  <span className="font-medium text-gray-700">{t("cronLastRun")}:</span>{" "}
                  {formatCronDate(job.state.lastRunAt)}
                </div>
                <div>
                  <span className="font-medium text-gray-700">{t("cronLastStatus")}:</span>{" "}
                  {job.state.lastStatus ?? "-"}
                </div>
                <div>
                  <span className="font-medium text-gray-700">{t("cronSessionLabel")}:</span>{" "}
                  {describeCronSession(job)}
                </div>
              </div>
              <div className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-700">
                {job.payload.message}
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}

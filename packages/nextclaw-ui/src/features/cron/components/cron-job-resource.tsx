import { CronJobDetailDialog } from "./cron-job-detail-dialog";
import { useCronJobs } from "@/features/cron/hooks/use-cron-jobs";
import { useCronJobActions } from "@/features/cron/hooks/use-cron-job-actions";
import { t } from "@/shared/lib/i18n";

export function CronJobResource({ jobId }: { jobId: string }) {
  const query = useCronJobs({ all: true });
  const actions = useCronJobActions();
  const job = query.data?.jobs.find((item) => item.id === jobId);
  if (query.isPending)
    return (
      <p role="status" className="p-4">
        {t("loading")}
      </p>
    );
  if (query.isError)
    return (
      <div className="p-4">
        <p role="alert">{t("resourceLoadFailed")}</p>
        <button onClick={() => void query.refetch()}>
          {t("resourceRetry")}
        </button>
      </div>
    );
  if (!job)
    return (
      <p role="alert" className="p-4">
        {t("resourceNotFound")}
      </p>
    );
  return (
    <>
      <CronJobDetailDialog
        embedded
        job={job}
        open
        onOpenChange={() => {}}
        onDelete={(value) => {
          void actions.deleteJob(value);
        }}
        onRun={(value) => {
          void actions.runJob(value);
        }}
        onToggle={(value, enabled) => {
          void actions.toggleJob(value, enabled);
        }}
      />
      <actions.ConfirmDialog />
    </>
  );
}

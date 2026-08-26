import { useState } from "react";

import type { CronJobView } from "@/shared/lib/api";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import { t } from "@/shared/lib/i18n";
import {
  useDeleteCronJob,
  useRunCronJob,
  useToggleCronJob,
} from "./use-cron-jobs";

type AfterSuccess = () => void;

function describeJob(job: CronJobView): string {
  return job.name ? `${job.name} (${job.id})` : job.id;
}

export function useCronJobActions() {
  const deleteCronJob = useDeleteCronJob();
  const runCronJob = useRunCronJob();
  const toggleCronJob = useToggleCronJob();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [pendingJobIds, setPendingJobIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const execute = async (
    job: CronJobView,
    action: () => Promise<unknown>,
    afterSuccess?: AfterSuccess,
  ): Promise<boolean> => {
    setPendingJobIds((ids) => new Set(ids).add(job.id));
    try {
      await action();
      afterSuccess?.();
      return true;
    } catch {
      return false;
    } finally {
      setPendingJobIds((ids) => {
        const nextIds = new Set(ids);
        nextIds.delete(job.id);
        return nextIds;
      });
    }
  };

  const deleteJob = async (
    job: CronJobView,
    afterSuccess?: AfterSuccess,
  ): Promise<boolean> => {
    const confirmed = await confirm({
      title: `${t("cronDeleteConfirm")}?`,
      description: describeJob(job),
      confirmLabel: t("delete"),
      variant: "destructive",
    });
    if (!confirmed) {
      return false;
    }
    return await execute(
      job,
      () => deleteCronJob.mutateAsync({ id: job.id }),
      afterSuccess,
    );
  };

  const runJob = async (
    job: CronJobView,
    afterSuccess?: AfterSuccess,
  ): Promise<boolean> => {
    const force = !job.enabled;
    if (force) {
      const confirmed = await confirm({
        title: `${t("cronRunForceConfirm")}?`,
        description: describeJob(job),
        confirmLabel: t("cronRunNow"),
      });
      if (!confirmed) {
        return false;
      }
    }
    return await execute(
      job,
      () => runCronJob.mutateAsync({ id: job.id, force }),
      afterSuccess,
    );
  };

  const toggleJob = async (
    job: CronJobView,
    enabled: boolean,
    afterSuccess?: AfterSuccess,
  ): Promise<boolean> => {
    return await execute(
      job,
      () => toggleCronJob.mutateAsync({ id: job.id, enabled }),
      afterSuccess,
    );
  };

  return {
    ConfirmDialog,
    deleteJob,
    isPending: (job: CronJobView) => pendingJobIds.has(job.id),
    runJob,
    toggleJob,
  };
}

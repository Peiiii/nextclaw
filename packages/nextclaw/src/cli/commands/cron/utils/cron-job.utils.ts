export type CronSchedule =
  | { kind: "every"; everyMs?: number | null }
  | { kind: "cron"; expr?: string | null }
  | { kind: "at"; atMs?: number | null };

export type CronPayload = {
  message: string;
  agentId?: string | null;
  deliver?: boolean;
  channel?: string | null;
  to?: string | null;
  accountId?: string | null;
};

export type CronJobView = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
};

export function formatCronSchedule(schedule: CronSchedule): string {
  if (schedule.kind === "every") {
    return `every ${Math.round((schedule.everyMs ?? 0) / 1000)}s`;
  }
  if (schedule.kind === "cron") {
    return schedule.expr ?? "";
  }
  return schedule.atMs ? new Date(schedule.atMs).toISOString() : "";
}

export function printCronJobs(jobs: CronJobView[]): void {
  if (!jobs.length) {
    console.log("No scheduled jobs.");
    return;
  }
  for (const job of jobs) {
    console.log(`${job.id} [${job.enabled ? "enabled" : "disabled"}] ${job.name} ${formatCronSchedule(job.schedule)}`);
  }
}

import { CronService, getDataDir } from "@nextclaw/core";
import { join } from "node:path";
import type { CronAddOptions } from "../../types.js";
import type { CronJobView, CronSchedule } from "./cron-job.utils.js";

function createCronService(): CronService {
  const storePath = join(getDataDir(), "cron", "jobs.json");
  return new CronService(storePath);
}

function toSchedule(opts: CronAddOptions): CronSchedule | null {
  if (opts.every) {
    return { kind: "every", everyMs: Number(opts.every) * 1000 };
  }
  if (opts.cron) {
    return { kind: "cron", expr: String(opts.cron) };
  }
  if (opts.at) {
    return { kind: "at", atMs: Date.parse(String(opts.at)) };
  }
  return null;
}

export class CronLocalService {
  readonly list = (all: boolean): CronJobView[] => {
    const service = createCronService();
    return service.listJobs(all) as CronJobView[];
  };

  readonly add = (opts: CronAddOptions): { job: CronJobView | null; error?: string } => {
    const schedule = toSchedule(opts);
    if (!schedule) {
      return { job: null, error: "Error: Must specify --every, --cron, or --at" };
    }
    const service = createCronService();
    const job = service.addJob({
      name: opts.name,
      schedule,
      message: opts.message,
      agentId: opts.agent,
      deliver: Boolean(opts.deliver),
      channel: opts.channel,
      to: opts.to,
      accountId: opts.account
    }) as CronJobView;
    return { job };
  };

  readonly remove = (jobId: string): boolean => {
    const service = createCronService();
    return service.removeJob(jobId);
  };

  readonly enable = (jobId: string, enabled: boolean): CronJobView | null => {
    const service = createCronService();
    return (service.enableJob(jobId, enabled) as CronJobView | null) ?? null;
  };

  readonly run = async (jobId: string, force: boolean): Promise<boolean> => {
    const service = createCronService();
    return service.runJob(jobId, force);
  };
}

import { getDataDir } from "@nextclaw/core";
import { AutomationManager } from "@nextclaw/kernel";
import type { CronCreateRequest } from "@nextclaw/server";
import type { CronAddOptions } from "@nextclaw-service/shared/types/cli.types.js";
import type { CronJobView } from "@nextclaw-service/cli/commands/cron/utils/cron-job.utils.js";
import { resolve } from "node:path";

function readTrimmed(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function toSchedule(opts: CronAddOptions): { schedule?: CronCreateRequest["schedule"]; error?: string } {
  const every = readTrimmed(opts.every);
  const cron = readTrimmed(opts.cron);
  const at = readTrimmed(opts.at);
  const scheduleFlags = [every, cron, at].filter((value) => value !== undefined);
  if (scheduleFlags.length !== 1) {
    return { error: "Error: Must specify exactly one of --every, --cron, or --at" };
  }
  if (every) {
    const everySeconds = Number(every);
    if (!Number.isFinite(everySeconds) || everySeconds <= 0) {
      return { error: "Error: --every must be a positive number of seconds" };
    }
    return { schedule: { kind: "every", everyMs: everySeconds * 1000 } };
  }
  if (cron) {
    return { schedule: { kind: "cron", expr: cron } };
  }
  const atMs = Date.parse(String(at));
  if (!Number.isFinite(atMs)) {
    return { error: "Error: --at must be a valid ISO datetime" };
  }
  return { schedule: { kind: "at", atMs } };
}

export function createCronCreateRequest(opts: CronAddOptions): { request?: CronCreateRequest; error?: string } {
  const name = readTrimmed(opts.name);
  const message = readTrimmed(opts.message);
  if (!name || !message) {
    return { error: "Error: name and message are required" };
  }
  const schedule = toSchedule(opts);
  if (!schedule.schedule) {
    return { error: schedule.error ?? "Error: Must specify --every, --cron, or --at" };
  }
  return {
    request: {
      name,
      message,
      schedule: schedule.schedule,
      agentId: readTrimmed(opts.agent),
      sessionId: readTrimmed(opts.session),
      deliver: Boolean(opts.deliver),
      channel: readTrimmed(opts.channel),
      to: readTrimmed(opts.to),
      accountId: readTrimmed(opts.account)
    }
  };
}

export class CronLocalService {
  constructor(
    private readonly automation = new AutomationManager({
      storePath: resolve(getDataDir(), "cron", "jobs.json")
    })
  ) {}

  readonly list = (all: boolean): CronJobView[] => {
    return this.automation.listJobs(all) as CronJobView[];
  };

  readonly addRequest = (request: CronCreateRequest): CronJobView => {
    return this.automation.addJob({
      name: request.name,
      schedule: request.schedule,
      message: request.message,
      agentId: request.agentId ?? undefined,
      sessionId: request.sessionId ?? undefined,
      deliver: request.deliver === true,
      channel: request.channel ?? undefined,
      to: request.to ?? undefined,
      accountId: request.accountId ?? undefined,
      deleteAfterRun: request.deleteAfterRun === true
    }) as CronJobView;
  };

  readonly add = (opts: CronAddOptions): { job: CronJobView | null; error?: string } => {
    const request = createCronCreateRequest(opts);
    if (!request.request) {
      return { job: null, error: request.error };
    }
    return { job: this.addRequest(request.request) };
  };

  readonly remove = (jobId: string): boolean => {
    return this.automation.removeJob(jobId);
  };

  readonly enable = (jobId: string, enabled: boolean): CronJobView | null => {
    return (this.automation.enableJob(jobId, enabled) as CronJobView | null) ?? null;
  };

  readonly run = async (jobId: string, force: boolean): Promise<boolean> => {
    return this.automation.runJob(jobId, force);
  };
}

import type { CronJobView } from "@/shared/lib/api";
import { formatDateTime } from "@/shared/lib/i18n";

export function formatCronDate(value?: string | null): string {
  return formatDateTime(value ?? undefined);
}

function formatDateFromMs(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return formatDateTime(new Date(value));
}

function formatEveryDuration(ms?: number | null): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) {
    return "-";
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function describeCronSchedule(job: CronJobView): string {
  const { schedule } = job;
  if (schedule.kind === "cron") {
    return schedule.expr ? `cron ${schedule.expr}` : "cron";
  }
  if (schedule.kind === "every") {
    return `every ${formatEveryDuration(schedule.everyMs)}`;
  }
  if (schedule.kind === "at") {
    return `at ${formatDateFromMs(schedule.atMs)}`;
  }
  return "-";
}

export function describeCronSession(job: CronJobView): string {
  return job.payload.sessionId?.trim() || `cron:${job.id}`;
}

export function isCronJobForSession(job: CronJobView, sessionKey: string | null | undefined): boolean {
  const normalizedSessionKey = sessionKey?.trim();
  return Boolean(normalizedSessionKey && job.payload.sessionId?.trim() === normalizedSessionKey);
}

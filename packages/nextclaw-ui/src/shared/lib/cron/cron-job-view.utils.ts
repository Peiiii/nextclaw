import type { CronJobView } from "@/shared/lib/api";
import { formatDateTime, getLanguage } from "@/shared/lib/i18n";

export function formatCronDate(value?: string | null): string {
  return formatDateTime(value ?? undefined);
}

export function formatRelativeTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const now = Date.now();
  const diff = date.getTime() - now;
  const lang = getLanguage();
  const absDiff = Math.abs(diff);

  if (absDiff < 60_000) {
    return lang === "zh" ? "刚刚" : "just now";
  }
  if (absDiff < 3_600_000) {
    const m = Math.round(absDiff / 60_000);
    return diff > 0
      ? lang === "zh"
        ? `${m}分钟后`
        : `in ${m}m`
      : lang === "zh"
        ? `${m}分钟前`
        : `${m}m ago`;
  }
  if (absDiff < 86_400_000) {
    const h = Math.round(absDiff / 3_600_000);
    return diff > 0
      ? lang === "zh"
        ? `${h}小时后`
        : `in ${h}h`
      : lang === "zh"
        ? `${h}小时前`
        : `${h}h ago`;
  }
  const d = Math.round(absDiff / 86_400_000);
  return diff > 0
    ? lang === "zh"
      ? `${d}天后`
      : `in ${d}d`
    : lang === "zh"
      ? `${d}天前`
      : `${d}d ago`;
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

const DOW_NAMES_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const DOW_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: string): string {
  return n.padStart(2, "0");
}

function humanizeCronExpr(expr: string, lang: string): string | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, month, dow] = parts;
  const isZh = lang === "zh";

  // Every minute
  if (min === "*" && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return isZh ? "每分钟" : "every minute";
  }

  // Every N minutes
  if (min.startsWith("*/") && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    const n = parseInt(min.slice(2), 10);
    if (Number.isFinite(n) && n > 0) {
      return isZh ? `每 ${n} 分钟` : `every ${n}m`;
    }
  }

  // Every hour
  if (min === "0" && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return isZh ? "每小时" : "every hour";
  }

  // Specific time helper
  const time = `${pad2(hour)}:${pad2(min)}`;

  // Daily
  if (min !== "*" && hour !== "*" && dom === "*" && month === "*" && dow === "*") {
    return isZh ? `每天 ${time}` : `daily ${time}`;
  }

  // Weekday (Mon-Fri)
  if (min !== "*" && hour !== "*" && dom === "*" && month === "*" && dow === "1-5") {
    return isZh ? `工作日 ${time}` : `weekdays ${time}`;
  }

  // Weekend (Sat & Sun)
  if (min !== "*" && hour !== "*" && dom === "*" && month === "*" && (dow === "0,6" || dow === "6,0")) {
    return isZh ? `周末 ${time}` : `weekends ${time}`;
  }

  // Specific day of week (single value 0-6)
  if (min !== "*" && hour !== "*" && dom === "*" && month === "*" && /^\d$/.test(dow)) {
    const dayIndex = parseInt(dow, 10);
    const name = isZh ? DOW_NAMES_ZH[dayIndex] : DOW_NAMES_EN[dayIndex];
    return name ? `${name} ${time}` : null;
  }

  // Monthly on specific day
  if (min !== "*" && hour !== "*" && dom !== "*" && month === "*" && dow === "*") {
    return isZh ? `每月 ${dom} 日 ${time}` : `monthly ${dom} ${time}`;
  }

  // Unmatched: return null so caller falls back to raw expression
  return null;
}

export function describeCronSchedule(job: CronJobView): string {
  const lang = getLanguage();
  const isZh = lang === "zh";
  const { schedule } = job;

  if (schedule.kind === "cron") {
    if (!schedule.expr) return "cron";
    return humanizeCronExpr(schedule.expr, lang) ?? `cron ${schedule.expr}`;
  }
  if (schedule.kind === "every") {
    const dur = formatEveryDuration(schedule.everyMs);
    return isZh ? `每 ${dur}` : `every ${dur}`;
  }
  if (schedule.kind === "at") {
    return `${isZh ? "定时" : "at"} ${formatDateFromMs(schedule.atMs)}`;
  }
  return "-";
}

export function describeCronSession(job: CronJobView): string {
  return job.payload.sessionId?.trim() || `cron:${job.id}`;
}

export function isCronJobForSession(
  job: CronJobView,
  sessionKey: string | null | undefined,
): boolean {
  const normalizedSessionKey = sessionKey?.trim();
  return Boolean(
    normalizedSessionKey &&
    job.payload.sessionId?.trim() === normalizedSessionKey,
  );
}

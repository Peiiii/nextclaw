import {
  deleteExpiredProductActivity,
  insertProductActivityReceipt,
  readProductActivityMetrics,
  readProductActivityTrend,
} from "@/repositories/product-activity.repository";
import type {
  ProductActivityAudience,
  ProductActivityEnvironment,
  ProductActivityInput,
  ProductActivityMetric,
  ProductActivityOverview,
  ProductActivityOverviewFilter,
  ProductActivityPeriodKind,
  ProductActivityPlatform,
  ProductActivityReleaseChannel,
} from "@/types/product-activity.types";
import type { Env } from "@/types/platform";

const TIMEZONE = "Asia/Shanghai" as const;
const RETENTION_DAYS = 180;
const MAX_CLOCK_SKEW_MS = 7 * 24 * 60 * 60 * 1_000;
const ALLOWED_INPUT_KEYS = new Set([
  "schemaVersion",
  "receiptId",
  "metric",
  "periodKind",
  "periodStart",
  "occurredAt",
  "audience",
  "environment",
  "releaseChannel",
  "platform",
  "appVersion",
]);

export type ProductActivityInputResult =
  | { ok: true; input: ProductActivityInput }
  | { ok: false; code: string; message: string };

export class ProductActivityService {
  constructor(
    private readonly env: Env,
    private readonly now: () => Date = () => new Date(),
  ) {}

  ingest = async (input: ProductActivityInput): Promise<void> => {
    const now = this.now();
    const nowIso = now.toISOString();
    await insertProductActivityReceipt(this.env.NEXTCLAW_PLATFORM_DB, {
      receiptId: input.receiptId,
      metric: input.metric,
      periodKind: input.periodKind,
      periodStart: input.periodStart,
      audience: input.audience,
      environment: input.environment,
      releaseChannel: input.releaseChannel,
      platform: input.platform,
      appVersion: input.appVersion,
      receivedAt: nowIso,
    });
    await deleteExpiredProductActivity(
      this.env.NEXTCLAW_PLATFORM_DB,
      new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1_000).toISOString(),
    );
  };

  readOverview = async (
    filter: ProductActivityOverviewFilter,
  ): Promise<ProductActivityOverview> => {
    const now = this.now();
    const periods = resolvePeriodStarts(now);
    const trendStart = formatBusinessDate(addDays(now, -(filter.trendDays - 1)));
    const [metrics, trendRows] = await Promise.all([
      readProductActivityMetrics({
        db: this.env.NEXTCLAW_PLATFORM_DB,
        filter,
        dayStart: periods.day,
        weekStart: periods.week,
        monthStart: periods.month,
      }),
      readProductActivityTrend({
        db: this.env.NEXTCLAW_PLATFORM_DB,
        filter,
        startDate: trendStart,
      }),
    ]);
    const trendByDate = new Map(trendRows.map((row) => [row.activity_date, row]));
    const trend = Array.from({ length: filter.trendDays }, (_, index) => {
      const date = formatBusinessDate(addDays(now, index - filter.trendDays + 1));
      const row = trendByDate.get(date);
      return {
        date,
        active: normalizeCount(row?.active),
        successful: normalizeCount(row?.successful),
      };
    });
    return {
      timezone: TIMEZONE,
      asOfDate: periods.day,
      filters: filter,
      metrics: {
        dau: normalizeCount(metrics.dau),
        wau: normalizeCount(metrics.wau),
        mau: normalizeCount(metrics.mau),
        successfulDau: normalizeCount(metrics.successful_dau),
        successfulWau: normalizeCount(metrics.successful_wau),
        successfulMau: normalizeCount(metrics.successful_mau),
      },
      trend,
    };
  };
}

export function parseProductActivityInput(
  value: unknown,
  now: Date = new Date(),
): ProductActivityInputResult {
  if (!isRecord(value)) {
    return invalid("INVALID_ANALYTICS_PAYLOAD", "A JSON object is required.");
  }
  const fieldFailure = validateProductActivityFields(value);
  if (fieldFailure) {
    return fieldFailure;
  }
  const timeFailure = validateProductActivityTime(value, now);
  if (timeFailure) {
    return timeFailure;
  }
  return { ok: true, input: value as ProductActivityInput };
}

function validateProductActivityFields(
  value: Record<string, unknown>,
): ProductActivityInputResult | null {
  const unknownKey = Object.keys(value).find((key) => !ALLOWED_INPUT_KEYS.has(key));
  if (unknownKey) {
    return invalid("UNSUPPORTED_ANALYTICS_FIELD", `Unsupported field: ${unknownKey}.`);
  }
  if (value.schemaVersion !== 2) {
    return invalid("INVALID_ANALYTICS_SCHEMA", "schemaVersion must be 2.");
  }
  if (typeof value.receiptId !== "string" || !isUuid(value.receiptId)) {
    return invalid("INVALID_RECEIPT_ID", "receiptId must be a UUID.");
  }
  if (!isMetric(value.metric)) {
    return invalid("INVALID_ANALYTICS_METRIC", "Unsupported analytics metric.");
  }
  if (!isPeriodKind(value.periodKind)) {
    return invalid("INVALID_ANALYTICS_PERIOD", "Unsupported analytics period.");
  }
  if (typeof value.periodStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.periodStart)) {
    return invalid("INVALID_PERIOD_START", "periodStart must be a calendar date.");
  }
  if (!isAudience(value.audience)) {
    return invalid("INVALID_ANALYTICS_AUDIENCE", "Unsupported audience.");
  }
  if (!isEnvironment(value.environment)) {
    return invalid("INVALID_ANALYTICS_ENVIRONMENT", "Unsupported environment.");
  }
  if (!isReleaseChannel(value.releaseChannel)) {
    return invalid("INVALID_ANALYTICS_RELEASE_CHANNEL", "Unsupported release channel.");
  }
  if (!isPlatform(value.platform)) {
    return invalid("INVALID_ANALYTICS_PLATFORM", "Unsupported platform.");
  }
  if (
    typeof value.appVersion !== "string"
    || value.appVersion.length < 1
    || value.appVersion.length > 80
  ) {
    return invalid("INVALID_APP_VERSION", "appVersion must be between 1 and 80 characters.");
  }
  return null;
}

function validateProductActivityTime(
  value: Record<string, unknown>,
  now: Date,
): ProductActivityInputResult | null {
  if (typeof value.occurredAt !== "string") {
    return invalid("INVALID_OCCURRED_AT", "occurredAt must be an ISO timestamp.");
  }
  const occurredAt = new Date(value.occurredAt);
  if (
    Number.isNaN(occurredAt.getTime())
    || Math.abs(now.getTime() - occurredAt.getTime()) > MAX_CLOCK_SKEW_MS
  ) {
    return invalid("INVALID_OCCURRED_AT", "occurredAt is outside the accepted clock window.");
  }
  const periodKind = value.periodKind as ProductActivityPeriodKind;
  const expectedPeriodStart = resolvePeriodStarts(occurredAt)[periodKind];
  if (value.periodStart !== expectedPeriodStart) {
    return invalid("INVALID_PERIOD_START", "periodStart does not match occurredAt.");
  }
  return null;
}

export function parseProductActivityAudience(
  value: string | undefined,
): ProductActivityAudience {
  return isAudience(value) ? value : "external";
}

export function parseProductActivityEnvironment(
  value: string | undefined,
): ProductActivityEnvironment {
  return isEnvironment(value) ? value : "production";
}

export function parseProductActivityReleaseChannel(
  value: string | undefined,
): ProductActivityReleaseChannel {
  return isReleaseChannel(value) ? value : "stable";
}

function resolvePeriodStarts(date: Date): Record<ProductActivityPeriodKind, string> {
  const day = formatBusinessDate(date);
  const [year, month, dateOfMonth] = day.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, dateOfMonth ?? 1));
  const weekday = utcDate.getUTCDay() || 7;
  return {
    day,
    week: formatUtcDate(new Date(utcDate.getTime() - (weekday - 1) * 86_400_000)),
    month: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`,
  };
}

function formatBusinessDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatUtcDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function normalizeCount(value: number | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function invalid(code: string, message: string): ProductActivityInputResult {
  return { ok: false, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isAudience(value: unknown): value is ProductActivityAudience {
  return value === "external" || value === "internal" || value === "qa";
}

function isEnvironment(value: unknown): value is ProductActivityEnvironment {
  return value === "production" || value === "development" || value === "test";
}

function isReleaseChannel(value: unknown): value is ProductActivityReleaseChannel {
  return value === "stable" || value === "beta" || value === "nightly" || value === "development";
}

function isPlatform(value: unknown): value is ProductActivityPlatform {
  return value === "macos" || value === "windows" || value === "linux" || value === "other";
}

function isMetric(value: unknown): value is ProductActivityMetric {
  return value === "active" || value === "successful";
}

function isPeriodKind(value: unknown): value is ProductActivityPeriodKind {
  return value === "day" || value === "week" || value === "month";
}

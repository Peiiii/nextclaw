import {
  deleteExpiredProductActivity,
  readProductActivityMetrics,
  readProductActivityTrend,
  upsertProductActivity,
} from "@/repositories/product-activity.repository";
import type {
  ProductActivityAudience,
  ProductActivityEnvironment,
  ProductActivityInput,
  ProductActivityOverview,
  ProductActivityOverviewFilter,
  ProductActivityPlatform,
  ProductActivityReleaseChannel,
  ProductActivitySource,
} from "@/types/product-activity.types";
import type { Env, UserRow } from "@/types/platform";
import { readAuthSecret } from "@/utils/platform.utils";

const TIMEZONE = "Asia/Shanghai" as const;
const RETENTION_DAYS = 180;
const MAX_CLOCK_SKEW_MS = 7 * 24 * 60 * 60 * 1_000;
const ALLOWED_INPUT_KEYS = new Set([
  "schemaVersion",
  "installationId",
  "event",
  "occurredAt",
  "source",
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

  ingest = async (
    input: ProductActivityInput,
    user: UserRow | null,
  ): Promise<void> => {
    const secret = readAuthSecret(this.env);
    if (!secret) {
      throw new Error("PRODUCT_ANALYTICS_UNAVAILABLE");
    }
    const now = this.now();
    const nowIso = now.toISOString();
    const activityDate = formatBusinessDate(now);
    const audience = resolveAudience(input.audience, user);
    const installationHash = await hashInstallationId(input.installationId, secret);
    await upsertProductActivity(this.env.NEXTCLAW_PLATFORM_DB, {
      installationHash,
      linkedUserId: user?.id ?? null,
      audience,
      environment: input.environment,
      releaseChannel: input.releaseChannel,
      platform: input.platform,
      appVersion: input.appVersion,
      activityDate,
      event: input.event,
      source: input.source,
      nowIso,
    });

    const cutoff = addBusinessDays(now, -RETENTION_DAYS);
    await deleteExpiredProductActivity(
      this.env.NEXTCLAW_PLATFORM_DB,
      formatBusinessDate(cutoff),
      cutoff.toISOString(),
    );
  };

  readOverview = async (
    filter: ProductActivityOverviewFilter,
  ): Promise<ProductActivityOverview> => {
    const now = this.now();
    const today = formatBusinessDate(now);
    const wauStart = formatBusinessDate(addBusinessDays(now, -6));
    const mauStart = formatBusinessDate(addBusinessDays(now, -29));
    const trendStart = formatBusinessDate(addBusinessDays(now, -(filter.trendDays - 1)));
    const [metrics, trendRows] = await Promise.all([
      readProductActivityMetrics({
        db: this.env.NEXTCLAW_PLATFORM_DB,
        filter,
        today,
        wauStart,
        mauStart,
      }),
      readProductActivityTrend({
        db: this.env.NEXTCLAW_PLATFORM_DB,
        filter,
        startDate: trendStart,
      }),
    ]);
    const trendByDate = new Map(trendRows.map((row) => [row.activity_date, row]));
    const trend = Array.from({ length: filter.trendDays }, (_, index) => {
      const date = formatBusinessDate(addBusinessDays(now, index - filter.trendDays + 1));
      const row = trendByDate.get(date);
      return {
        date,
        active: normalizeCount(row?.active),
        successful: normalizeCount(row?.successful),
      };
    });
    const wau = normalizeCount(metrics.wau);
    const identified = normalizeCount(metrics.wau_identified_users);
    return {
      timezone: TIMEZONE,
      asOfDate: today,
      filters: filter,
      metrics: {
        dau: normalizeCount(metrics.dau),
        wau,
        mau: normalizeCount(metrics.mau),
        successfulDau: normalizeCount(metrics.successful_dau),
        successfulWau: normalizeCount(metrics.successful_wau),
        successfulMau: normalizeCount(metrics.successful_mau),
        wauAnonymousInstallations: normalizeCount(metrics.wau_anonymous_installations),
        wauIdentifiedUsers: identified,
        wauIdentificationRate: wau > 0 ? Number((identified / wau).toFixed(4)) : 0,
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
  const unknownKey = Object.keys(value).find((key) => !ALLOWED_INPUT_KEYS.has(key));
  if (unknownKey) {
    return invalid("UNSUPPORTED_ANALYTICS_FIELD", `Unsupported field: ${unknownKey}.`);
  }
  if (value.schemaVersion !== 1) {
    return invalid("INVALID_ANALYTICS_SCHEMA", "schemaVersion must be 1.");
  }
  if (typeof value.installationId !== "string" || !isUuid(value.installationId)) {
    return invalid("INVALID_INSTALLATION_ID", "installationId must be a UUID.");
  }
  if (value.event !== "intent_accepted" && value.event !== "run_succeeded") {
    return invalid("INVALID_ANALYTICS_EVENT", "Unsupported analytics event.");
  }
  if (value.source !== "direct" && value.source !== "channel") {
    return invalid("INVALID_ANALYTICS_SOURCE", "source must be direct or channel.");
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

  return { ok: true, input: value as ProductActivityInput };
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

function resolveAudience(
  reported: ProductActivityAudience,
  user: UserRow | null,
): ProductActivityAudience {
  if (!user) {
    return reported;
  }
  return user.role === "admin" ? "internal" : user.analytics_audience;
}

async function hashInstallationId(installationId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`nextclaw-product-activity:v1\0${installationId}`),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatBusinessDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addBusinessDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1_000);
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

export function isProductActivitySource(value: unknown): value is ProductActivitySource {
  return value === "direct" || value === "channel";
}

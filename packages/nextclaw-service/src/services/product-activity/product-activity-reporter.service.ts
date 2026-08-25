import type { Config } from "@nextclaw/core";
import type { ProductActivitySignal, ProductActivitySink } from "@nextclaw/kernel";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { resolvePlatformApiBase } from "@nextclaw-service/utils/remote/platform-api-base.utils.js";

type ProductActivityAudience = "external" | "internal" | "qa";
type ProductActivityEnvironment = "production" | "development" | "test";
type ProductActivityReleaseChannel = "stable" | "beta" | "nightly" | "development";
type ProductActivityMetric = "active" | "successful";
type ProductActivityPeriodKind = "day" | "week" | "month";

type ProductActivityReporterOptions = {
  homeDir: string;
  productVersion: string;
  loadConfig: () => Config;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

type ProductActivityReceiptState = {
  receiptId: string;
  periodKind: ProductActivityPeriodKind;
  periodStart: string;
  metric: ProductActivityMetric;
  occurredAt: string;
  deliveredAt: string | null;
};

type ProductActivityReporterState = {
  schemaVersion: 2;
  receipts: Record<string, ProductActivityReceiptState>;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

export type ProductActivityReporterStatus = {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  pendingReceiptCount: number;
};

const REPORT_TIMEOUT_MS = 3_000;
const STATE_SCHEMA_VERSION = 2;

export class ProductActivityReporter implements ProductActivitySink {
  private readonly env: NodeJS.ProcessEnv;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly statePath: string;
  private readonly legacyInstallationStatePath: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly options: ProductActivityReporterOptions) {
    this.env = options.env ?? process.env;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.statePath = resolve(options.homeDir, "product-analytics", "state.json");
    this.legacyInstallationStatePath = resolve(
      options.homeDir,
      "product-analytics",
      "installation.json",
    );
  }

  record = async (signal: ProductActivitySignal): Promise<void> => {
    this.queue = this.queue
      .catch(() => undefined)
      .then(async () => await this.recordSerialized(signal));
    await this.queue;
  };

  getStatus = (): ProductActivityReporterStatus => {
    const state = this.readState();
    return {
      lastAttemptAt: state.lastAttemptAt,
      lastSuccessAt: state.lastSuccessAt,
      lastError: state.lastError,
      pendingReceiptCount: Object.values(state.receipts)
        .filter((receipt) => receipt.deliveredAt === null).length,
    };
  };

  private recordSerialized = async (signal: ProductActivitySignal): Promise<void> => {
    this.removeLegacyIdentity();
    const config = this.options.loadConfig();
    if (!config.productAnalytics.enabled) {
      this.clearState();
      return;
    }

    const occurredAt = new Date(signal.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) return;
    const metric: ProductActivityMetric = signal.kind === "intent_accepted"
      ? "active"
      : "successful";
    const periods = resolvePeriodStarts(occurredAt);
    const state = this.pruneState(this.readState(), periods);

    for (const periodKind of ["day", "week", "month"] as const) {
      const periodStart = periods[periodKind];
      const key = receiptKey(periodKind, periodStart, metric);
      const current = state.receipts[key] ?? {
        receiptId: randomUUID(),
        periodKind,
        periodStart,
        metric,
        occurredAt: signal.occurredAt,
        deliveredAt: null,
      };
      state.receipts[key] = current;
      if (current.deliveredAt !== null) continue;
      this.writeState(state);
      await this.deliverReceipt(state, current, config);
    }
  };

  private deliverReceipt = async (
    state: ProductActivityReporterState,
    receipt: ProductActivityReceiptState,
    config: Config,
  ): Promise<void> => {
    state.lastAttemptAt = this.now().toISOString();
    const platformBase = resolvePlatformApiBase({
      configuredApiBase: config.providers.nextclaw?.apiBase,
    }).platformBase;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(`${platformBase}/platform/analytics/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaVersion: STATE_SCHEMA_VERSION,
          receiptId: receipt.receiptId,
          metric: receipt.metric,
          periodKind: receipt.periodKind,
          periodStart: receipt.periodStart,
          occurredAt: receipt.occurredAt,
          audience: config.productAnalytics.audience satisfies ProductActivityAudience,
          environment: resolveEnvironment(this.env),
          releaseChannel: resolveReleaseChannel(this.env),
          platform: resolvePlatform(),
          appVersion: normalizeAppVersion(this.options.productVersion),
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const deliveredAt = this.now().toISOString();
      receipt.deliveredAt = deliveredAt;
      state.lastSuccessAt = deliveredAt;
      state.lastError = null;
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timeout);
      this.writeState(state);
    }
  };

  private readState = (): ProductActivityReporterState => {
    try {
      const value = JSON.parse(readFileSync(this.statePath, "utf8")) as Partial<ProductActivityReporterState>;
      if (
        value.schemaVersion === STATE_SCHEMA_VERSION
        && value.receipts
        && typeof value.receipts === "object"
        && !Array.isArray(value.receipts)
      ) {
        return {
          schemaVersion: STATE_SCHEMA_VERSION,
          receipts: value.receipts,
          lastAttemptAt: typeof value.lastAttemptAt === "string" ? value.lastAttemptAt : null,
          lastSuccessAt: typeof value.lastSuccessAt === "string" ? value.lastSuccessAt : null,
          lastError: typeof value.lastError === "string" ? value.lastError : null,
        };
      }
    } catch {
      // Missing and invalid state both start from the same anonymous empty state.
    }
    return emptyState();
  };

  private pruneState = (
    state: ProductActivityReporterState,
    periods: Record<ProductActivityPeriodKind, string>,
  ): ProductActivityReporterState => {
    state.receipts = Object.fromEntries(
      Object.entries(state.receipts).filter(([, receipt]) => (
        receipt.periodStart === periods[receipt.periodKind]
      )),
    );
    return state;
  };

  private writeState = (state: ProductActivityReporterState): void => {
    mkdirSync(dirname(this.statePath), { recursive: true });
    const temporaryPath = `${this.statePath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporaryPath, this.statePath);
  };

  private clearState = (): void => {
    rmSync(this.statePath, { force: true });
  };

  private removeLegacyIdentity = (): void => {
    if (existsSync(this.legacyInstallationStatePath)) {
      rmSync(this.legacyInstallationStatePath, { force: true });
    }
  };
}

function emptyState(): ProductActivityReporterState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    receipts: {},
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
  };
}

function receiptKey(
  periodKind: ProductActivityPeriodKind,
  periodStart: string,
  metric: ProductActivityMetric,
): string {
  return `${periodKind}:${periodStart}:${metric}`;
}

function resolvePeriodStarts(date: Date): Record<ProductActivityPeriodKind, string> {
  const day = formatBusinessDate(date);
  const [year, month, dateOfMonth] = day.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, dateOfMonth ?? 1));
  const weekday = utcDate.getUTCDay() || 7;
  const weekDate = new Date(utcDate.getTime() - (weekday - 1) * 24 * 60 * 60 * 1_000);
  return {
    day,
    week: formatUtcDate(weekDate),
    month: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`,
  };
}

function formatBusinessDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
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

function normalizeAppVersion(version: string): string {
  const core = version.trim().split("-")[0] ?? "";
  const segments = core.split(".").filter(Boolean);
  return (segments.length >= 2 ? segments.slice(0, 2).join(".") : core).slice(0, 80) || "unknown";
}

function resolveEnvironment(env: NodeJS.ProcessEnv): ProductActivityEnvironment {
  const explicit = env.NEXTCLAW_PRODUCT_ANALYTICS_ENVIRONMENT?.trim().toLowerCase();
  if (explicit === "production" || explicit === "development" || explicit === "test") {
    return explicit;
  }
  if (env.NODE_ENV === "production") return "production";
  if (env.NODE_ENV === "test" || env.VITEST) return "test";
  return "development";
}

function resolveReleaseChannel(env: NodeJS.ProcessEnv): ProductActivityReleaseChannel {
  const raw = (
    env.NEXTCLAW_PRODUCT_ANALYTICS_RELEASE_CHANNEL
    ?? env.NEXTCLAW_DESKTOP_UPDATE_CHANNEL
    ?? env.NEXTCLAW_UPDATE_CHANNEL
    ?? ""
  ).trim().toLowerCase();
  if (raw === "stable" || raw === "beta" || raw === "nightly") return raw;
  return resolveEnvironment(env) === "production" ? "stable" : "development";
}

function resolvePlatform(): "macos" | "windows" | "linux" | "other" {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "win32") return "windows";
  if (process.platform === "linux") return "linux";
  return "other";
}

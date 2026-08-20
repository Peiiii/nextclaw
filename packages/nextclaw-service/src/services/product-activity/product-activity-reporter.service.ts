import type { Config } from "@nextclaw/core";
import type {
  ProductActivitySignal,
  ProductActivitySink,
} from "@nextclaw/kernel";
import { isValidPlatformSessionToken } from "@nextclaw/remote";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { resolvePlatformApiBase } from "@nextclaw-service/utils/remote/platform-api-base.utils.js";

type ProductActivityAudience = "external" | "internal" | "qa";
type ProductActivityEnvironment = "production" | "development" | "test";
type ProductActivityReleaseChannel = "stable" | "beta" | "nightly" | "development";

type ProductActivityReporterOptions = {
  homeDir: string;
  productVersion: string;
  loadConfig: () => Config;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
};

type InstallationState = {
  schemaVersion: 1;
  installationId: string;
};

const REPORT_TIMEOUT_MS = 3_000;

export class ProductActivityReporter implements ProductActivitySink {
  private readonly env: NodeJS.ProcessEnv;
  private readonly fetchImpl: typeof fetch;
  private readonly installationStatePath: string;
  private installationId: string | null = null;

  constructor(private readonly options: ProductActivityReporterOptions) {
    this.env = options.env ?? process.env;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.installationStatePath = resolve(
      options.homeDir,
      "product-analytics",
      "installation.json",
    );
  }

  record = async (signal: ProductActivitySignal): Promise<void> => {
    try {
      const config = this.options.loadConfig();
      if (!config.productAnalytics.enabled) {
        return;
      }

      const installationId = this.readOrCreateInstallationId();
      const provider = config.providers.nextclaw;
      const platformBase = resolvePlatformApiBase({
        configuredApiBase: provider?.apiBase,
      }).platformBase;
      const token = provider?.apiKey?.trim();
      const headers = new Headers({ "Content-Type": "application/json" });
      if (isValidPlatformSessionToken(token)) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);
      try {
        await this.fetchImpl(`${platformBase}/platform/analytics/activity`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            schemaVersion: 1,
            installationId,
            event: signal.kind,
            occurredAt: signal.occurredAt,
            source: signal.source,
            audience: config.productAnalytics.audience satisfies ProductActivityAudience,
            environment: resolveEnvironment(this.env),
            releaseChannel: resolveReleaseChannel(this.env),
            platform: resolvePlatform(),
            appVersion: this.options.productVersion,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Reporting is intentionally best-effort and cannot change product behavior.
    }
  };

  private readOrCreateInstallationId = (): string => {
    if (this.installationId) {
      return this.installationId;
    }
    try {
      const state = JSON.parse(
        readFileSync(this.installationStatePath, "utf8"),
      ) as Partial<InstallationState>;
      if (
        state.schemaVersion === 1
        && typeof state.installationId === "string"
        && isUuid(state.installationId)
      ) {
        this.installationId = state.installationId;
        return state.installationId;
      }
    } catch {
      // A missing or invalid state file is replaced with a new random identity.
    }

    const installationId = randomUUID();
    const state: InstallationState = { schemaVersion: 1, installationId };
    mkdirSync(dirname(this.installationStatePath), { recursive: true });
    const temporaryPath = `${this.installationStatePath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporaryPath, this.installationStatePath);
    this.installationId = installationId;
    return installationId;
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function resolveEnvironment(env: NodeJS.ProcessEnv): ProductActivityEnvironment {
  const explicit = env.NEXTCLAW_PRODUCT_ANALYTICS_ENVIRONMENT?.trim().toLowerCase();
  if (explicit === "production" || explicit === "development" || explicit === "test") {
    return explicit;
  }
  if (env.NODE_ENV === "production") {
    return "production";
  }
  if (env.NODE_ENV === "test" || env.VITEST) {
    return "test";
  }
  return "development";
}

function resolveReleaseChannel(env: NodeJS.ProcessEnv): ProductActivityReleaseChannel {
  const raw = (
    env.NEXTCLAW_PRODUCT_ANALYTICS_RELEASE_CHANNEL
    ?? env.NEXTCLAW_DESKTOP_UPDATE_CHANNEL
    ?? env.NEXTCLAW_UPDATE_CHANNEL
    ?? ""
  ).trim().toLowerCase();
  if (raw === "stable" || raw === "beta" || raw === "nightly") {
    return raw;
  }
  return resolveEnvironment(env) === "production" ? "stable" : "development";
}

function resolvePlatform(): "macos" | "windows" | "linux" | "other" {
  if (process.platform === "darwin") {
    return "macos";
  }
  if (process.platform === "win32") {
    return "windows";
  }
  if (process.platform === "linux") {
    return "linux";
  }
  return "other";
}

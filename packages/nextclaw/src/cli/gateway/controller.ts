import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  buildConfigSchema,
  buildReloadPlan,
  ConfigSchema,
  diffConfigPaths,
  normalizeInlineSecretRefs,
  redactConfigObject,
  type Config,
  type GatewayController,
  type CronService,
  type ChannelManager,
  type SessionManager
} from "@nextclaw/core";
import { getPackageVersion } from "../utils.js";
import { runSelfUpdate } from "../update/runner.js";
import {
  parseSessionKey,
  type RestartSentinelDeliveryContext,
  writeRestartSentinel
} from "../restart-sentinel.js";

type ConfigReloaderLike = {
  getChannels: () => ChannelManager;
  applyReloadPlan: (nextConfig: Config) => Promise<void>;
  reloadConfig: (reason?: string) => Promise<string>;
};

type ControllerDeps = {
  reloader: ConfigReloaderLike;
  cron: CronService;
  sessionManager?: SessionManager;
  getConfigPath: () => string;
  saveConfig: (config: Config) => void;
  requestRestart?: (options?: { delayMs?: number; reason?: string }) => Promise<void> | void;
};

const hashRaw = (raw: string): string => createHash("sha256").update(raw).digest("hex");

const readConfigSnapshot = (getConfigPath: () => string): {
  raw: string | null;
  hash: string | null;
  config: Config;
  redacted: Record<string, unknown>;
  valid: boolean;
} => {
  const path = getConfigPath();
  let raw = "";
  let parsed: Record<string, unknown> = {};
  if (existsSync(path)) {
    raw = readFileSync(path, "utf-8");
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  let config: Config;
  let valid = true;
  try {
    config = ConfigSchema.parse(normalizeInlineSecretRefs(parsed));
  } catch {
    config = ConfigSchema.parse({});
    valid = false;
  }
  if (!raw) {
    raw = JSON.stringify(config, null, 2);
  }
  const hash = hashRaw(raw);
  const schema = buildConfigSchema({ version: getPackageVersion() });
  const redacted = redactConfigObject(config, schema.uiHints) as Record<string, unknown>;
  return { raw: valid ? JSON.stringify(redacted, null, 2) : null, hash: valid ? hash : null, config, redacted, valid };
};

const redactValue = (value: Config): Record<string, unknown> => {
  const schema = buildConfigSchema({ version: getPackageVersion() });
  return redactConfigObject(value, schema.uiHints) as Record<string, unknown>;
};

const mergeDeep = (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const baseVal = base[key];
      if (baseVal && typeof baseVal === "object" && !Array.isArray(baseVal)) {
        next[key] = mergeDeep(baseVal as Record<string, unknown>, value as Record<string, unknown>);
      } else {
        next[key] = mergeDeep({}, value as Record<string, unknown>);
      }
    } else {
      next[key] = value;
    }
  }
  return next;
};

const buildPendingRestartMessage = (paths: string[]): string => {
  if (paths.length === 0) {
    return "Config saved. Restart manually to apply changes.";
  }
  return `Config saved. Restart manually to apply: ${paths.join(", ")}.`;
};

export class GatewayControllerImpl implements GatewayController {
  constructor(private deps: ControllerDeps) {}

  private normalizeOptionalString = (value: unknown): string | undefined => {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  };

  private resolveDeliveryContext = (sessionKey?: string): RestartSentinelDeliveryContext | undefined => {
    const normalizedSessionKey = this.normalizeOptionalString(sessionKey);
    const keyTarget = parseSessionKey(normalizedSessionKey);
    const keyRoute = keyTarget && keyTarget.channel !== "agent" ? keyTarget : null;
    const session = normalizedSessionKey ? this.deps.sessionManager?.getIfExists(normalizedSessionKey) : null;
    const metadata = session?.metadata ?? {};
    const rawContext = metadata.last_delivery_context;
    const cachedContext =
      rawContext && typeof rawContext === "object" && !Array.isArray(rawContext)
        ? (rawContext as Record<string, unknown>)
        : null;
    const cachedMetadataRaw = cachedContext?.metadata;
    const cachedMetadata =
      cachedMetadataRaw && typeof cachedMetadataRaw === "object" && !Array.isArray(cachedMetadataRaw)
        ? ({ ...(cachedMetadataRaw as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    const channel = this.normalizeOptionalString(cachedContext?.channel) ?? keyRoute?.channel;
    const chatId =
      this.normalizeOptionalString(cachedContext?.chatId) ??
      this.normalizeOptionalString(metadata.last_to) ??
      keyRoute?.chatId;
    const replyTo =
      this.normalizeOptionalString(cachedContext?.replyTo) ??
      this.normalizeOptionalString(metadata.last_message_id);
    const accountId =
      this.normalizeOptionalString(cachedContext?.accountId) ??
      this.normalizeOptionalString(metadata.last_account_id);

    if (!channel || !chatId) {
      return undefined;
    }

    if (accountId && !this.normalizeOptionalString(cachedMetadata.accountId)) {
      cachedMetadata.accountId = accountId;
    }

    return {
      channel,
      chatId,
      ...(replyTo ? { replyTo } : {}),
      ...(accountId ? { accountId } : {}),
      ...(Object.keys(cachedMetadata).length > 0 ? { metadata: cachedMetadata } : {})
    };
  };

  private writeRestartSentinelPayload = async (params: {
    kind: "config.apply" | "config.patch" | "update.run" | "restart";
    status: "ok" | "error" | "skipped";
    sessionKey?: string;
    note?: string;
    reason?: string;
    strategy?: string;
  }): Promise<string | null> => {
    const sessionKey = this.normalizeOptionalString(params.sessionKey);
    const deliveryContext = this.resolveDeliveryContext(sessionKey);
    try {
      return await writeRestartSentinel({
        kind: params.kind,
        status: params.status,
        ts: Date.now(),
        sessionKey,
        deliveryContext,
        message: params.note ?? null,
        stats: {
          reason: params.reason ?? null,
          strategy: params.strategy ?? null
        }
      });
    } catch {
      return null;
    }
  };

  private requestRestart = async (options?: { delayMs?: number; reason?: string }): Promise<void> => {
    if (this.deps.requestRestart) {
      await this.deps.requestRestart(options);
      return;
    }
    const delay =
      typeof options?.delayMs === "number" && Number.isFinite(options.delayMs) ? Math.max(0, options.delayMs) : 100;
    console.log(`Gateway restart requested via tool${options?.reason ? ` (${options.reason})` : ""}.`);
    setTimeout(() => {
      process.exit(0);
    }, delay);
  };

  private createConfigMutationResult = (params: {
    changedPaths: string[];
    config: Config;
    note?: string;
    plan: ReturnType<typeof buildReloadPlan>;
  }): Record<string, unknown> => {
    const pendingRestart =
      params.plan.restartRequired.length > 0
        ? {
            required: true,
            automatic: false,
            changedPaths: [...params.plan.restartRequired],
            message: buildPendingRestartMessage(params.plan.restartRequired)
          }
        : null;
    const message =
      params.changedPaths.length === 0
        ? "Config already matched the requested state."
        : pendingRestart
          ? params.changedPaths.length > params.plan.restartRequired.length
            ? "Config saved. Supported changes were applied immediately; restart manually to apply the rest."
            : "Config saved. Restart manually to apply changes."
          : "Config saved and applied.";

    return {
      ok: true,
      note: params.note ?? null,
      path: this.deps.getConfigPath(),
      config: redactValue(params.config),
      changedPaths: [...params.changedPaths],
      message,
      pendingRestart
    };
  };

  private applyConfigChange = async (params: {
    kind: "config.apply" | "config.patch";
    nextConfig: Config;
    note?: string;
  }): Promise<Record<string, unknown>> => {
    const snapshot = readConfigSnapshot(this.deps.getConfigPath);
    const changedPaths = diffConfigPaths(snapshot.config, params.nextConfig);
    const plan = buildReloadPlan(changedPaths);

    if (changedPaths.length === 0) {
      return this.createConfigMutationResult({
        changedPaths,
        config: params.nextConfig,
        note: params.note,
        plan
      });
    }

    this.deps.saveConfig(params.nextConfig);
    await this.deps.reloader.applyReloadPlan(params.nextConfig);
    return this.createConfigMutationResult({
      changedPaths,
      config: params.nextConfig,
      note: params.note,
      plan
    });
  };

  status = (): Record<string, unknown> => {
    return {
      channels: this.deps.reloader.getChannels().enabledChannels,
      cron: this.deps.cron.status(),
      configPath: this.deps.getConfigPath()
    };
  };

  reloadConfig = async (reason?: string): Promise<string> => {
    return this.deps.reloader.reloadConfig(reason);
  };

  restart = async (options?: { delayMs?: number; reason?: string; sessionKey?: string }): Promise<string> => {
    await this.writeRestartSentinelPayload({
      kind: "restart",
      status: "ok",
      sessionKey: options?.sessionKey,
      reason: options?.reason ?? "gateway.restart"
    });
    await this.requestRestart(options);
    return "Restart scheduled";
  };

  getConfig = async (): Promise<Record<string, unknown>> => {
    const snapshot = readConfigSnapshot(this.deps.getConfigPath);
    return {
      raw: snapshot.raw,
      hash: snapshot.hash,
      path: this.deps.getConfigPath(),
      config: snapshot.redacted,
      parsed: snapshot.redacted,
      resolved: snapshot.redacted,
      valid: snapshot.valid
    };
  };

  getConfigSchema = async (): Promise<Record<string, unknown>> => {
    return buildConfigSchema({ version: getPackageVersion() });
  };

  applyConfig = async (params: {
    raw: string;
    baseHash?: string;
    note?: string;
    restartDelayMs?: number;
    sessionKey?: string;
  }): Promise<Record<string, unknown>> => {
    const snapshot = readConfigSnapshot(this.deps.getConfigPath);
    if (!params.baseHash) {
      return { ok: false, error: "config base hash required; re-run config.get and retry" };
    }
    if (!snapshot.valid || !snapshot.hash) {
      return { ok: false, error: "config base hash unavailable; re-run config.get and retry" };
    }
    if (params.baseHash !== snapshot.hash) {
      return { ok: false, error: "config changed since last load; re-run config.get and retry" };
    }
    let parsedRaw: Record<string, unknown>;
    try {
      parsedRaw = JSON.parse(params.raw) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "invalid JSON in raw config" };
    }
    let validated: Config;
    try {
      validated = ConfigSchema.parse(normalizeInlineSecretRefs(parsedRaw));
    } catch (err) {
      return { ok: false, error: `invalid config: ${String(err)}` };
    }
    return this.applyConfigChange({
      kind: "config.apply",
      nextConfig: validated,
      note: params.note
    });
  };

  patchConfig = async (params: {
    raw: string;
    baseHash?: string;
    note?: string;
    restartDelayMs?: number;
    sessionKey?: string;
  }): Promise<Record<string, unknown>> => {
    const snapshot = readConfigSnapshot(this.deps.getConfigPath);
    if (!params.baseHash) {
      return { ok: false, error: "config base hash required; re-run config.get and retry" };
    }
    if (!snapshot.valid || !snapshot.hash) {
      return { ok: false, error: "config base hash unavailable; re-run config.get and retry" };
    }
    if (params.baseHash !== snapshot.hash) {
      return { ok: false, error: "config changed since last load; re-run config.get and retry" };
    }
    let patch: Record<string, unknown>;
    try {
      patch = JSON.parse(params.raw) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "invalid JSON in raw config" };
    }
    const merged = mergeDeep(snapshot.config as Record<string, unknown>, patch);
    let validated: Config;
    try {
      validated = ConfigSchema.parse(normalizeInlineSecretRefs(merged));
    } catch (err) {
      return { ok: false, error: `invalid config: ${String(err)}` };
    }
    return this.applyConfigChange({
      kind: "config.patch",
      nextConfig: validated,
      note: params.note
    });
  };

  updateRun = async (params: {
    note?: string;
    restartDelayMs?: number;
    timeoutMs?: number;
    sessionKey?: string;
  }): Promise<Record<string, unknown>> => {
    const versionBefore = getPackageVersion();
    const result = runSelfUpdate({ timeoutMs: params.timeoutMs });
    if (!result.ok) {
      return {
        ok: false,
        error: result.error ?? "update failed",
        steps: result.steps,
        version: {
          before: versionBefore,
          after: getPackageVersion(),
          changed: false
        }
      };
    }

    const versionAfter = getPackageVersion();
    const delayMs = params.restartDelayMs ?? 0;
    const sentinelPath = await this.writeRestartSentinelPayload({
      kind: "update.run",
      status: "ok",
      sessionKey: params.sessionKey,
      note: params.note,
      reason: "update.run",
      strategy: result.strategy
    });
    await this.requestRestart({ delayMs, reason: "update.run" });
    return {
      ok: true,
      note: params.note ?? null,
      restart: { scheduled: true, delayMs },
      strategy: result.strategy,
      steps: result.steps,
      version: {
        before: versionBefore,
        after: versionAfter,
        changed: versionBefore !== versionAfter
      },
      sentinel: sentinelPath ? { path: sentinelPath } : null
    };
  };
}

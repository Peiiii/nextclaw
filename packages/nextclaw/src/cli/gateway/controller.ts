import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  buildConfigSchema,
  ConfigSchema,
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
    config = ConfigSchema.parse(parsed);
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

export class GatewayControllerImpl implements GatewayController {
  constructor(private deps: ControllerDeps) {}

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private resolveDeliveryContext(sessionKey?: string): RestartSentinelDeliveryContext | undefined {
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
  }

  private async writeRestartSentinelPayload(params: {
    kind: "config.apply" | "config.patch" | "update.run" | "restart";
    status: "ok" | "error" | "skipped";
    sessionKey?: string;
    note?: string;
    reason?: string;
      strategy?: string;
  }): Promise<string | null> {
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
  }

  private async requestRestart(options?: { delayMs?: number; reason?: string }): Promise<void> {
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
  }

  status(): Record<string, unknown> {
    return {
      channels: this.deps.reloader.getChannels().enabledChannels,
      cron: this.deps.cron.status(),
      configPath: this.deps.getConfigPath()
    };
  }

  async reloadConfig(reason?: string): Promise<string> {
    return this.deps.reloader.reloadConfig(reason);
  }

  async restart(options?: { delayMs?: number; reason?: string; sessionKey?: string }): Promise<string> {
    await this.writeRestartSentinelPayload({
      kind: "restart",
      status: "ok",
      sessionKey: options?.sessionKey,
      reason: options?.reason ?? "gateway.restart"
    });
    await this.requestRestart(options);
    return "Restart scheduled";
  }

  async getConfig(): Promise<Record<string, unknown>> {
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
  }

  async getConfigSchema(): Promise<Record<string, unknown>> {
    return buildConfigSchema({ version: getPackageVersion() });
  }

  async applyConfig(params: {
    raw: string;
    baseHash?: string;
    note?: string;
    restartDelayMs?: number;
    sessionKey?: string;
  }): Promise<Record<string, unknown>> {
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
      validated = ConfigSchema.parse(parsedRaw);
    } catch (err) {
      return { ok: false, error: `invalid config: ${String(err)}` };
    }
    this.deps.saveConfig(validated);
    const delayMs = params.restartDelayMs ?? 0;
    const sentinelPath = await this.writeRestartSentinelPayload({
      kind: "config.apply",
      status: "ok",
      sessionKey: params.sessionKey,
      note: params.note,
      reason: "config.apply"
    });
    await this.requestRestart({ delayMs, reason: "config.apply" });
    return {
      ok: true,
      note: params.note ?? null,
      path: this.deps.getConfigPath(),
      config: redactValue(validated),
      restart: { scheduled: true, delayMs },
      sentinel: sentinelPath ? { path: sentinelPath } : null
    };
  }

  async patchConfig(params: {
    raw: string;
    baseHash?: string;
    note?: string;
    restartDelayMs?: number;
    sessionKey?: string;
  }): Promise<Record<string, unknown>> {
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
      validated = ConfigSchema.parse(merged);
    } catch (err) {
      return { ok: false, error: `invalid config: ${String(err)}` };
    }
    this.deps.saveConfig(validated);
    const delayMs = params.restartDelayMs ?? 0;
    const sentinelPath = await this.writeRestartSentinelPayload({
      kind: "config.patch",
      status: "ok",
      sessionKey: params.sessionKey,
      note: params.note,
      reason: "config.patch"
    });
    await this.requestRestart({ delayMs, reason: "config.patch" });
    return {
      ok: true,
      note: params.note ?? null,
      path: this.deps.getConfigPath(),
      config: redactValue(validated),
      restart: { scheduled: true, delayMs },
      sentinel: sentinelPath ? { path: sentinelPath } : null
    };
  }

  async updateRun(params: {
    note?: string;
    restartDelayMs?: number;
    timeoutMs?: number;
    sessionKey?: string;
  }): Promise<Record<string, unknown>> {
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
  }
}

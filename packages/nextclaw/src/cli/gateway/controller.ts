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
  type PluginUiMetadata
} from "@nextclaw/core";
import { getPackageVersion } from "../utils.js";
import { runSelfUpdate } from "../update/runner.js";

type ConfigReloaderLike = {
  getChannels: () => ChannelManager;
  reloadConfig: (reason?: string) => Promise<string>;
};

type ControllerDeps = {
  reloader: ConfigReloaderLike;
  cron: CronService;
  getConfigPath: () => string;
  saveConfig: (config: Config) => void;
  getPluginUiMetadata?: () => PluginUiMetadata[];
  requestRestart?: (options?: { delayMs?: number; reason?: string }) => Promise<void> | void;
};

const hashRaw = (raw: string): string => createHash("sha256").update(raw).digest("hex");

const readConfigSnapshot = (getConfigPath: () => string, plugins: PluginUiMetadata[]): {
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
  const schema = buildConfigSchema({ version: getPackageVersion(), plugins });
  const redacted = redactConfigObject(config, schema.uiHints) as Record<string, unknown>;
  return { raw: valid ? JSON.stringify(redacted, null, 2) : null, hash: valid ? hash : null, config, redacted, valid };
};

const redactValue = (value: Config, plugins: PluginUiMetadata[]): Record<string, unknown> => {
  const schema = buildConfigSchema({ version: getPackageVersion(), plugins });
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

  async restart(options?: { delayMs?: number; reason?: string }): Promise<string> {
    await this.requestRestart(options);
    return "Restart scheduled";
  }

  async getConfig(): Promise<Record<string, unknown>> {
    const plugins = this.deps.getPluginUiMetadata?.() ?? [];
    const snapshot = readConfigSnapshot(this.deps.getConfigPath, plugins);
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
    return buildConfigSchema({ version: getPackageVersion(), plugins: this.deps.getPluginUiMetadata?.() ?? [] });
  }

  async applyConfig(params: {
    raw: string;
    baseHash?: string;
    note?: string;
    restartDelayMs?: number;
    sessionKey?: string;
  }): Promise<Record<string, unknown>> {
    const plugins = this.deps.getPluginUiMetadata?.() ?? [];
    const snapshot = readConfigSnapshot(this.deps.getConfigPath, plugins);
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
    await this.requestRestart({ delayMs, reason: "config.apply" });
    return {
      ok: true,
      note: params.note ?? null,
      path: this.deps.getConfigPath(),
      config: redactValue(validated, plugins),
      restart: { scheduled: true, delayMs }
    };
  }

  async patchConfig(params: {
    raw: string;
    baseHash?: string;
    note?: string;
    restartDelayMs?: number;
    sessionKey?: string;
  }): Promise<Record<string, unknown>> {
    const plugins = this.deps.getPluginUiMetadata?.() ?? [];
    const snapshot = readConfigSnapshot(this.deps.getConfigPath, plugins);
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
    await this.requestRestart({ delayMs, reason: "config.patch" });
    return {
      ok: true,
      note: params.note ?? null,
      path: this.deps.getConfigPath(),
      config: redactValue(validated, plugins),
      restart: { scheduled: true, delayMs }
    };
  }

  async updateRun(params: {
    note?: string;
    restartDelayMs?: number;
    timeoutMs?: number;
    sessionKey?: string;
  }): Promise<Record<string, unknown>> {
    const result = runSelfUpdate({ timeoutMs: params.timeoutMs });
    if (!result.ok) {
      return { ok: false, error: result.error ?? "update failed", steps: result.steps };
    }

    const delayMs = params.restartDelayMs ?? 0;
    await this.requestRestart({ delayMs, reason: "update.run" });
    return {
      ok: true,
      note: params.note ?? null,
      restart: { scheduled: true, delayMs },
      strategy: result.strategy,
      steps: result.steps
    };
  }
}

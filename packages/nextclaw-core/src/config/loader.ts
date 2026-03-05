import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { z } from "zod";
import {
  ConfigSchema,
  type Config,
  type ProviderConfig
} from "./schema.js";
import { getDataPath } from "../utils/helpers.js";
import { normalizeInlineSecretRefs } from "./secrets.js";

export function getConfigPath(): string {
  return resolve(getDataPath(), "config.json");
}

export function getDataDir(): string {
  return getDataPath();
}

export function loadConfig(configPath?: string): Config {
  const path = configPath ?? getConfigPath();
  let shouldPersist = false;
  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, "utf-8");
      const data = JSON.parse(raw);
      const migrated = migrateConfig(data);
      const config = ConfigSchema.parse(migrated);
      if (ensureBuiltinNextclawKey(config)) {
        shouldPersist = true;
      }
      if (shouldPersist) {
        persistConfigSafely(config, path);
      }
      return config;
    } catch (err) {
      const message = err instanceof z.ZodError ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`Warning: Failed to load config from ${path}: ${message}`);
    }
  }
  const config = ConfigSchema.parse({});
  if (ensureBuiltinNextclawKey(config)) {
    persistConfigSafely(config, path);
  }
  return config;
}

export function saveConfig(config: Config, configPath?: string): void {
  const path = configPath ?? getConfigPath();
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2));
}

function migrateConfig(data: Record<string, unknown>): Record<string, unknown> {
  const tools = (data.tools ?? {}) as Record<string, unknown>;
  const execConfig = (tools.exec ?? {}) as Record<string, unknown>;
  if (execConfig.restrictToWorkspace !== undefined && tools.restrictToWorkspace === undefined) {
    tools.restrictToWorkspace = execConfig.restrictToWorkspace;
  }
  const providers = (data.providers ?? {}) as Record<string, unknown>;
  const nextclawProvider = (providers.nextclaw ?? {}) as Record<string, unknown>;
  const nextclawApiBase = typeof nextclawProvider.apiBase === "string" ? nextclawProvider.apiBase.trim() : "";
  if (nextclawApiBase === "https://api.nextclaw.io/v1") {
    nextclawProvider.apiBase = "https://ai-gateway-api.nextclaw.io/v1";
  }
  return normalizeInlineSecretRefs({
    ...data,
    tools,
    providers: {
      ...providers,
      nextclaw: nextclawProvider
    }
  });
}

function ensureBuiltinNextclawKey(config: Config): boolean {
  const providers = config.providers as Record<string, ProviderConfig>;
  let changed = false;
  let provider = providers.nextclaw;

  if (!provider) {
    provider = {
      displayName: "",
      apiKey: "",
      apiBase: null,
      extraHeaders: null,
      wireApi: "auto",
      models: []
    };
    providers.nextclaw = provider;
    changed = true;
  }
  const current = typeof provider.apiKey === "string" ? provider.apiKey.trim() : "";
  if (current.length > 0) {
    return changed;
  }
  provider.apiKey = `nc_free_${randomBytes(24).toString("base64url")}`;
  return true;
}

function persistConfigSafely(config: Config, path: string): void {
  try {
    saveConfig(config, path);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Warning: Failed to persist config to ${path}: ${String(error)}`);
  }
}

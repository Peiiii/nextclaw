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
  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, "utf-8");
      const data = JSON.parse(raw);
      const { config: migrated, changed: migratedChanged } = migrateConfig(data);
      const config = ConfigSchema.parse(migrated);
      let shouldPersist = migratedChanged;
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

function migrateConfig(data: Record<string, unknown>): { config: Record<string, unknown>; changed: boolean } {
  let changed = false;
  const tools = (data.tools ?? {}) as Record<string, unknown>;
  const execConfig = (tools.exec ?? {}) as Record<string, unknown>;
  if (execConfig.restrictToWorkspace !== undefined && tools.restrictToWorkspace === undefined) {
    tools.restrictToWorkspace = execConfig.restrictToWorkspace;
    changed = true;
  }
  const providers = (data.providers ?? {}) as Record<string, unknown>;
  const nextclawProvider = (providers.nextclaw ?? {}) as Record<string, unknown>;
  const nextclawApiBase = typeof nextclawProvider.apiBase === "string" ? nextclawProvider.apiBase.trim() : "";
  if (nextclawApiBase === "https://api.nextclaw.io/v1") {
    nextclawProvider.apiBase = "https://ai-gateway-api.nextclaw.io/v1";
    changed = true;
  }
  const legacyWebSearch = (tools.web ?? {}) as Record<string, unknown>;
  const legacyWebSearchConfig = (legacyWebSearch.search ?? {}) as Record<string, unknown>;
  const rawSearch = (data.search ?? {}) as Record<string, unknown>;
  const rawSearchProviders = (rawSearch.providers ?? {}) as Record<string, unknown>;
  const braveSearch = (rawSearchProviders.brave ?? {}) as Record<string, unknown>;
  const bochaSearch = (rawSearchProviders.bocha ?? {}) as Record<string, unknown>;

  if (
    typeof legacyWebSearchConfig.apiKey === "string" &&
    legacyWebSearchConfig.apiKey.trim().length > 0 &&
    typeof braveSearch.apiKey !== "string"
  ) {
    braveSearch.apiKey = legacyWebSearchConfig.apiKey;
    changed = true;
  }
  if (
    typeof legacyWebSearchConfig.maxResults === "number" &&
    Number.isFinite(legacyWebSearchConfig.maxResults) &&
    !("defaults" in rawSearch)
  ) {
    rawSearch.defaults = {
      maxResults: legacyWebSearchConfig.maxResults
    };
    changed = true;
  }
  if (rawSearch.provider === undefined) {
    rawSearch.provider = "bocha";
    changed = true;
  }
  const rawEnabledProviders = Array.isArray(rawSearch.enabledProviders)
    ? rawSearch.enabledProviders.filter((value): value is string => typeof value === "string")
    : [];
  const currentEnabledProviders = Array.isArray(rawSearch.enabledProviders)
    ? rawSearch.enabledProviders.filter((value): value is string => typeof value === "string")
    : [];
  const normalizedEnabledProviders = Array.from(new Set(
    rawEnabledProviders.filter((value) => value === "bocha" || value === "brave")
  ));
  if (
    currentEnabledProviders.length !== normalizedEnabledProviders.length
    || normalizedEnabledProviders.some((value, index) => currentEnabledProviders[index] !== value)
  ) {
    rawSearch.enabledProviders = normalizedEnabledProviders;
    changed = true;
  }

  const normalized = normalizeInlineSecretRefs({
    ...data,
    tools,
    search: {
      ...rawSearch,
      providers: {
        ...rawSearchProviders,
        bocha: bochaSearch,
        brave: braveSearch
      }
    },
    providers: {
      ...providers,
      ...(providers.nextclaw ? { nextclaw: nextclawProvider } : {})
    }
  });
  return {
    config: normalized,
    changed
  };
}

function ensureBuiltinNextclawKey(config: Config): boolean {
  const providers = config.providers as Record<string, ProviderConfig>;
  let changed = false;
  let provider = providers.nextclaw;

  if (!provider) {
    provider = {
      enabled: false,
      displayName: "",
      apiKey: "",
      apiBase: null,
      extraHeaders: null,
      wireApi: "auto",
      models: [],
      modelThinking: {}
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

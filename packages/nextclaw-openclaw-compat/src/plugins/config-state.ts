import type { Config } from "@nextclaw/core";

export type NormalizedPluginsConfig = {
  enabled: boolean;
  allow: string[];
  deny: string[];
  loadPaths: string[];
  entries: Record<string, { enabled?: boolean; config?: unknown }>;
};

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);
}

function normalizeEntries(entries: unknown): NormalizedPluginsConfig["entries"] {
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    return {};
  }
  const normalized: NormalizedPluginsConfig["entries"] = {};
  for (const [idRaw, value] of Object.entries(entries)) {
    const id = idRaw.trim();
    if (!id) {
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      normalized[id] = {};
      continue;
    }
    const entry = value as Record<string, unknown>;
    normalized[id] = {
      enabled: typeof entry.enabled === "boolean" ? entry.enabled : undefined,
      config: Object.prototype.hasOwnProperty.call(entry, "config") ? entry.config : undefined
    };
  }
  return normalized;
}

export function normalizePluginsConfig(plugins: Config["plugins"] | undefined): NormalizedPluginsConfig {
  return {
    enabled: plugins?.enabled !== false,
    allow: normalizeList(plugins?.allow),
    deny: normalizeList(plugins?.deny),
    loadPaths: normalizeList(plugins?.load?.paths),
    entries: normalizeEntries(plugins?.entries)
  };
}

export function resolveEnableState(
  id: string,
  config: NormalizedPluginsConfig
): { enabled: boolean; reason?: string } {
  if (!config.enabled) {
    return { enabled: false, reason: "plugins disabled" };
  }
  if (config.deny.includes(id)) {
    return { enabled: false, reason: "blocked by denylist" };
  }
  if (config.allow.length > 0 && !config.allow.includes(id)) {
    return { enabled: false, reason: "not in allowlist" };
  }
  const entry = config.entries[id];
  if (entry?.enabled === true) {
    return { enabled: true };
  }
  if (entry?.enabled === false) {
    return { enabled: false, reason: "disabled in config" };
  }
  return { enabled: true };
}

export type PluginInstallSource = "npm" | "archive" | "path";

export type PluginInstallUpdate = {
  pluginId: string;
  source: PluginInstallSource;
  spec?: string;
  sourcePath?: string;
  installPath?: string;
  version?: string;
  installedAt?: string;
};

export function recordPluginInstall(config: Config, update: PluginInstallUpdate): Config {
  const { pluginId, ...record } = update;
  const installs = {
    ...(config.plugins.installs ?? {}),
    [pluginId]: {
      ...(config.plugins.installs?.[pluginId] ?? {}),
      ...record,
      installedAt: record.installedAt ?? new Date().toISOString()
    }
  };

  return {
    ...config,
    plugins: {
      ...config.plugins,
      installs
    }
  };
}

export function enablePluginInConfig(config: Config, pluginId: string): Config {
  const nextEntries = {
    ...(config.plugins.entries ?? {}),
    [pluginId]: {
      ...(config.plugins.entries?.[pluginId] ?? {}),
      enabled: true
    }
  };

  const allow = config.plugins.allow;
  const nextAllow = Array.isArray(allow) && allow.length > 0 && !allow.includes(pluginId) ? [...allow, pluginId] : allow;

  return {
    ...config,
    plugins: {
      ...config.plugins,
      entries: nextEntries,
      ...(nextAllow ? { allow: nextAllow } : {})
    }
  };
}

export function disablePluginInConfig(config: Config, pluginId: string): Config {
  return {
    ...config,
    plugins: {
      ...config.plugins,
      entries: {
        ...(config.plugins.entries ?? {}),
        [pluginId]: {
          ...(config.plugins.entries?.[pluginId] ?? {}),
          enabled: false
        }
      }
    }
  };
}

export function addPluginLoadPath(config: Config, loadPath: string): Config {
  const paths = Array.from(new Set([...(config.plugins.load?.paths ?? []), loadPath]));
  return {
    ...config,
    plugins: {
      ...config.plugins,
      load: {
        ...(config.plugins.load ?? {}),
        paths
      }
    }
  };
}

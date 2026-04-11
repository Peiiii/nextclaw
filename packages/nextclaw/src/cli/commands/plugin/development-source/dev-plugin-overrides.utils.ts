import fs from "node:fs";
import path from "node:path";
import type { Config } from "@nextclaw/core";
import {
  getPackageManifestExtensions,
  loadPluginManifest,
  type PackageManifest,
} from "@nextclaw/openclaw-compat";
import {
  applyDevFirstPartyPluginLoadPaths,
  resolveDevFirstPartyPluginInstallRoots,
} from "./first-party-plugin-load-paths.js";

export const DEV_PLUGIN_OVERRIDES_ENV = "NEXTCLAW_DEV_PLUGIN_OVERRIDES";
type PluginEntrySource = "production" | "development";

export type DevPluginOverride = {
  pluginId: string;
  pluginPath: string;
  source: PluginEntrySource;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readPackageManifest(pluginPath: string): PackageManifest | null {
  const packageJsonPath = path.join(pluginPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as PackageManifest;
  } catch {
    return null;
  }
}

function assertOverridePluginReadable(override: DevPluginOverride): void {
  if (!fs.existsSync(override.pluginPath)) {
    throw new Error(
      `[dev-plugin-override] plugin path does not exist for "${override.pluginId}": ${override.pluginPath}`,
    );
  }

  const packageManifest = readPackageManifest(override.pluginPath);
  if (!packageManifest) {
    throw new Error(
      `[dev-plugin-override] package.json is missing or invalid for "${override.pluginId}": ${override.pluginPath}`,
    );
  }

  const pluginManifest = loadPluginManifest(override.pluginPath);
  if (!pluginManifest.ok) {
    throw new Error(
      `[dev-plugin-override] ${pluginManifest.error} for "${override.pluginId}": ${override.pluginPath}`,
    );
  }
  if (pluginManifest.manifest.id !== override.pluginId) {
    throw new Error(
      `[dev-plugin-override] plugin id mismatch: expected "${override.pluginId}" but found "${pluginManifest.manifest.id}" at ${override.pluginPath}`,
    );
  }

  const extensions = getPackageManifestExtensions(packageManifest, override.source);
  if (extensions.length === 0) {
    const missingEntry =
      override.source === "development"
        ? "openclaw.development.extensions"
        : "openclaw.extensions";
    throw new Error(
      `[dev-plugin-override] ${missingEntry} is missing for "${override.pluginId}" at ${override.pluginPath}`,
    );
  }
}

function readOverrideRecord(
  value: unknown,
  index: number,
): DevPluginOverride {
  if (!isRecord(value)) {
    throw new Error(
      `[dev-plugin-override] override[${index}] must be an object`,
    );
  }

  const pluginId = readOptionalString(value.pluginId);
  const pluginPath = readOptionalString(value.pluginPath);
  const source =
    value.source === "development" ? "development" : "production";
  if (!pluginId || !pluginPath) {
    throw new Error(
      `[dev-plugin-override] override[${index}] requires pluginId and pluginPath`,
    );
  }

  const normalized = {
    pluginId,
    pluginPath: path.resolve(pluginPath),
    source,
  } satisfies DevPluginOverride;
  assertOverridePluginReadable(normalized);
  return normalized;
}

export function resolveDevPluginOverrides(
  rawEnv = process.env[DEV_PLUGIN_OVERRIDES_ENV],
): DevPluginOverride[] {
  if (typeof rawEnv !== "string" || rawEnv.trim().length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawEnv);
  } catch (error) {
    throw new Error(
      `[dev-plugin-override] failed to parse ${DEV_PLUGIN_OVERRIDES_ENV}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `[dev-plugin-override] ${DEV_PLUGIN_OVERRIDES_ENV} must be a JSON array`,
    );
  }

  const seenPluginIds = new Set<string>();
  const overrides = parsed.map((entry, index) => readOverrideRecord(entry, index));
  for (const entry of overrides) {
    if (seenPluginIds.has(entry.pluginId)) {
      throw new Error(
        `[dev-plugin-override] duplicate plugin override for "${entry.pluginId}"`,
      );
    }
    seenPluginIds.add(entry.pluginId);
  }
  return overrides;
}

function mergeLoadPaths(existingLoadPaths: string[], overrideLoadPaths: string[]): string[] {
  const merged = [...overrideLoadPaths];
  for (const entry of existingLoadPaths) {
    if (!merged.includes(entry)) {
      merged.push(entry);
    }
  }
  return merged;
}

function applyExplicitDevPluginOverrides(
  config: Config,
  overrides: DevPluginOverride[],
): Config {
  if (overrides.length === 0) {
    return config;
  }

  const nextEntries = { ...(config.plugins.entries ?? {}) };
  for (const override of overrides) {
    nextEntries[override.pluginId] = {
      ...(nextEntries[override.pluginId] ?? {}),
      source: override.source,
    };
  }

  const existingLoadPaths = Array.isArray(config.plugins.load?.paths)
    ? config.plugins.load.paths.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : [];

  return {
    ...config,
    plugins: {
      ...config.plugins,
      entries: nextEntries,
      load: {
        ...config.plugins.load,
        paths: mergeLoadPaths(
          existingLoadPaths,
          overrides.map((entry) => entry.pluginPath),
        ),
      },
    },
  };
}

function resolveDevPluginOverrideInstallRoots(
  config: Config,
  overrides: DevPluginOverride[],
): string[] {
  const installRoots: string[] = [];
  for (const override of overrides) {
    const installRecord = config.plugins.installs?.[override.pluginId];
    const installPath = readOptionalString(installRecord?.installPath);
    if (!installPath || installRoots.includes(installPath)) {
      continue;
    }
    installRoots.push(installPath);
  }
  return installRoots;
}

export function resolveDevPluginLoadingContext(
  config: Config,
  workspaceExtensionsDir: string | undefined,
  rawOverridesEnv = process.env[DEV_PLUGIN_OVERRIDES_ENV],
): {
  configWithDevPluginOverrides: Config;
  excludedRoots: string[];
  overrides: DevPluginOverride[];
} {
  const configWithFirstPartyOverrides = applyDevFirstPartyPluginLoadPaths(
    config,
    workspaceExtensionsDir,
  );
  const overrides = resolveDevPluginOverrides(rawOverridesEnv);
  const configWithDevPluginOverrides = applyExplicitDevPluginOverrides(
    configWithFirstPartyOverrides,
    overrides,
  );

  const excludedRoots = [
    ...resolveDevFirstPartyPluginInstallRoots(config, workspaceExtensionsDir),
    ...resolveDevPluginOverrideInstallRoots(config, overrides),
  ].filter((entry, index, list) => list.indexOf(entry) === index);

  return {
    configWithDevPluginOverrides,
    excludedRoots,
    overrides,
  };
}

import fs from "node:fs";
import path from "node:path";
import type { MarketplaceInstalledRecord } from "../../types.js";
import {
  BUILTIN_CHANNEL_PLUGIN_ID_PREFIX,
  NEXTCLAW_PLUGIN_NPM_PREFIX
} from "./constants.js";

function readPluginPackageNameFromSource(source: string | undefined): string | undefined {
  const trimmed = source?.trim();
  if (!trimmed) {
    return undefined;
  }

  let cursor = path.dirname(path.resolve(trimmed));
  for (let index = 0; index < 8; index += 1) {
    try {
      const manifestPath = path.join(cursor, "package.json");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { name?: unknown };
      if (typeof manifest.name === "string" && manifest.name.trim().length > 0) {
        return manifest.name.trim();
      }
    } catch {}

    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  return undefined;
}

export function normalizePluginNpmSpec(rawSpec: string): string {
  const spec = rawSpec.trim();
  if (!spec.startsWith("@")) {
    return spec;
  }

  const versionDelimiterIndex = spec.lastIndexOf("@");
  if (versionDelimiterIndex <= 0) {
    return spec;
  }

  const packageName = spec.slice(0, versionDelimiterIndex).trim();
  if (!packageName.includes("/")) {
    return spec;
  }

  return packageName;
}

export function isSupportedMarketplacePluginSpec(rawSpec: string): boolean {
  const spec = normalizePluginNpmSpec(rawSpec);
  return spec.length > 0;
}

export function resolvePluginCanonicalSpec(params: {
  pluginId: string;
  installSpec?: string;
}): string {
  const rawInstallSpec = typeof params.installSpec === "string" ? params.installSpec.trim() : "";
  if (rawInstallSpec.length > 0) {
    return normalizePluginNpmSpec(rawInstallSpec);
  }

  if (params.pluginId.startsWith(BUILTIN_CHANNEL_PLUGIN_ID_PREFIX)) {
    const channelSlug = params.pluginId.slice(BUILTIN_CHANNEL_PLUGIN_ID_PREFIX.length).trim();
    if (channelSlug.length > 0) {
      return `${NEXTCLAW_PLUGIN_NPM_PREFIX}${channelSlug}`;
    }
  }

  return params.pluginId;
}

export function resolveDiscoveredPluginCanonicalSpec(params: {
  pluginId: string;
  installSpec?: string;
  source?: string;
}): string {
  return resolvePluginCanonicalSpec({
    pluginId: params.pluginId,
    installSpec: params.installSpec ?? readPluginPackageNameFromSource(params.source)
  });
}

function readPluginRuntimeStatusPriority(status: string | undefined): number {
  if (status === "loaded") {
    return 400;
  }
  if (status === "disabled") {
    return 300;
  }
  if (status === "unresolved") {
    return 200;
  }
  return 100;
}

function readPluginOriginPriority(origin: string | undefined): number {
  if (origin === "bundled") {
    return 80;
  }
  if (origin === "workspace") {
    return 70;
  }
  if (origin === "global") {
    return 60;
  }
  if (origin === "config") {
    return 50;
  }
  return 10;
}

function readInstalledPluginRecordPriority(record: MarketplaceInstalledRecord): number {
  const installScore = record.installPath ? 20 : 0;
  const timestampScore = record.installedAt ? 10 : 0;
  return readPluginRuntimeStatusPriority(record.runtimeStatus) + readPluginOriginPriority(record.origin) + installScore + timestampScore;
}

function mergeInstalledPluginRecords(primary: MarketplaceInstalledRecord, secondary: MarketplaceInstalledRecord): MarketplaceInstalledRecord {
  return {
    ...primary,
    id: primary.id ?? secondary.id,
    label: primary.label ?? secondary.label,
    source: primary.source ?? secondary.source,
    installedAt: primary.installedAt ?? secondary.installedAt,
    enabled: primary.enabled ?? secondary.enabled,
    runtimeStatus: primary.runtimeStatus ?? secondary.runtimeStatus,
    origin: primary.origin ?? secondary.origin,
    installPath: primary.installPath ?? secondary.installPath
  };
}

export function dedupeInstalledPluginRecordsByCanonicalSpec(records: MarketplaceInstalledRecord[]): MarketplaceInstalledRecord[] {
  const deduped = new Map<string, MarketplaceInstalledRecord>();

  for (const record of records) {
    const canonicalSpec = normalizePluginNpmSpec(record.spec).trim();
    if (!canonicalSpec) {
      continue;
    }

    const key = canonicalSpec.toLowerCase();
    const normalizedRecord = { ...record, spec: canonicalSpec };
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, normalizedRecord);
      continue;
    }

    const normalizedScore = readInstalledPluginRecordPriority(normalizedRecord);
    const existingScore = readInstalledPluginRecordPriority(existing);
    if (normalizedScore > existingScore) {
      deduped.set(key, mergeInstalledPluginRecords(normalizedRecord, existing));
      continue;
    }

    deduped.set(key, mergeInstalledPluginRecords(existing, normalizedRecord));
  }

  return Array.from(deduped.values());
}

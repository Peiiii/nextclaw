import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Config } from "@nextclaw/core";
import { getWorkspacePathFromConfig } from "@nextclaw/core";
import { BUNDLED_CHANNEL_PLUGIN_PACKAGES } from "./bundled-channel-plugin-packages.constants.js";
import { normalizePluginsConfig, resolveEnableState } from "./config-state.js";
import { discoverOpenClawPlugins, type PluginCandidate } from "./discovery.js";
import type { PluginLogger, PluginRegistry } from "./types.js";
import { loadOpenClawPlugins } from "./loader.js";
import { createPluginRecord, validatePluginConfig } from "./plugin-loader-utils.js";
import { loadPluginManifestRegistry, type PluginManifestRecord } from "./manifest-registry.js";
import type { PluginDiagnostic, PluginRecord } from "./types.js";

export type PluginStatusReport = PluginRegistry & {
  workspaceDir: string;
};

function createEmptyPluginRegistry(): PluginRegistry {
  return {
    plugins: [],
    tools: [],
    channels: [],
    providers: [],
    engines: [],
    ncpAgentRuntimes: [],
    diagnostics: [],
    resolvedTools: []
  };
}

function resolvePackageRootFromEntry(entryFile: string): string {
  let cursor = path.dirname(entryFile);
  for (let index = 0; index < 8; index += 1) {
    const candidate = path.join(cursor, "package.json");
    if (fs.existsSync(candidate)) {
      return cursor;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }
  return path.dirname(entryFile);
}

function discoverBundledPluginCandidates(workspaceDir: string, diagnostics: PluginDiagnostic[]): PluginCandidate[] {
  const require = createRequire(import.meta.url);
  const candidates: PluginCandidate[] = [];

  for (const packageName of BUNDLED_CHANNEL_PLUGIN_PACKAGES) {
    try {
      const entryFile = require.resolve(packageName);
      candidates.push({
        idHint: packageName.split("/").pop() ?? packageName,
        source: entryFile,
        rootDir: resolvePackageRootFromEntry(entryFile),
        origin: "bundled",
        workspaceDir,
        packageName
      });
    } catch (error) {
      diagnostics.push({
        level: "error",
        source: packageName,
        message: `bundled plugin package not resolvable: ${String(error)}`
      });
    }
  }

  return candidates;
}

function createRecordFromManifest(
  manifest: PluginManifestRecord,
  enabled: boolean,
): PluginRecord {
  return createPluginRecord({
    id: manifest.id,
    name: manifest.name ?? manifest.id,
    description: manifest.description,
    version: manifest.version,
    kind: manifest.kind,
    source: manifest.source,
    origin: manifest.origin,
    workspaceDir: manifest.workspaceDir,
    enabled,
    configSchema: Boolean(manifest.configSchema),
    configUiHints: manifest.configUiHints,
    configJsonSchema: manifest.configSchema
  });
}

function createOverriddenManifestRecord(
  manifest: PluginManifestRecord,
  existingOrigin: PluginRecord["origin"],
): PluginRecord {
  const record = createRecordFromManifest(manifest, false);
  record.status = "disabled";
  record.error = `overridden by ${existingOrigin} plugin`;
  return record;
}

function finalizeDiscoveredManifestRecord(params: {
  manifest: PluginManifestRecord;
  normalizedEntries: Record<string, { enabled?: boolean; config?: unknown }>;
  enabled: boolean;
  disabledReason?: string;
}): { record: PluginRecord; diagnostics: PluginDiagnostic[] } {
  const record = createRecordFromManifest(params.manifest, params.enabled);
  if (!params.enabled) {
    record.status = "disabled";
    record.error = params.disabledReason;
    return { record, diagnostics: [] };
  }

  if (!params.manifest.configSchema) {
    record.status = "error";
    record.error = "missing config schema";
    return {
      record,
      diagnostics: [
        {
          level: "error",
          pluginId: params.manifest.id,
          source: params.manifest.source,
          message: record.error
        }
      ]
    };
  }

  const validatedConfig = validatePluginConfig({
    schema: params.manifest.configSchema,
    cacheKey: params.manifest.schemaCacheKey,
    value: params.normalizedEntries[params.manifest.id]?.config
  });
  if (validatedConfig.ok) {
    return { record, diagnostics: [] };
  }

  record.status = "error";
  record.error = `invalid config: ${validatedConfig.errors.join(", ")}`;
  return {
    record,
    diagnostics: [
      {
        level: "error",
        pluginId: params.manifest.id,
        source: params.manifest.source,
        message: record.error
      }
    ]
  };
}

export function discoverPluginStatusReport(params: {
  config: Config;
  workspaceDir?: string;
}): PluginStatusReport {
  const workspaceDir = params.workspaceDir?.trim() || getWorkspacePathFromConfig(params.config);
  const normalized = normalizePluginsConfig(params.config.plugins);
  const discovery = discoverOpenClawPlugins({
    config: params.config,
    workspaceDir,
    extraPaths: normalized.loadPaths
  });
  const bundledDiagnostics: PluginDiagnostic[] = [];
  const bundledCandidates = discoverBundledPluginCandidates(workspaceDir, bundledDiagnostics);
  const manifestRegistry = loadPluginManifestRegistry({
    config: params.config,
    workspaceDir,
    candidates: [...bundledCandidates, ...discovery.candidates],
    diagnostics: [...bundledDiagnostics, ...discovery.diagnostics]
  });
  const registry = createEmptyPluginRegistry();
  const seenIds = new Map<string, PluginRecord["origin"]>();

  registry.diagnostics.push(...manifestRegistry.diagnostics);

  for (const manifest of manifestRegistry.plugins) {
    const existingOrigin = seenIds.get(manifest.id);
    if (existingOrigin) {
      registry.plugins.push(createOverriddenManifestRecord(manifest, existingOrigin));
      continue;
    }

    const enableState = resolveEnableState(manifest.id, normalized);
    const { record, diagnostics } = finalizeDiscoveredManifestRecord({
      manifest,
      normalizedEntries: normalized.entries,
      enabled: enableState.enabled,
      disabledReason: enableState.reason
    });
    registry.plugins.push(record);
    registry.diagnostics.push(...diagnostics);
    seenIds.set(manifest.id, manifest.origin);
  }

  return {
    workspaceDir,
    ...registry
  };
}

export function buildPluginStatusReport(params: {
  config: Config;
  workspaceDir?: string;
  logger?: PluginLogger;
  reservedToolNames?: string[];
  reservedChannelIds?: string[];
  reservedProviderIds?: string[];
  reservedEngineKinds?: string[];
  reservedNcpAgentRuntimeKinds?: string[];
}): PluginStatusReport {
  const workspaceDir = params.workspaceDir?.trim() || getWorkspacePathFromConfig(params.config);
  const registry = loadOpenClawPlugins({
    config: params.config,
    workspaceDir,
    logger: params.logger,
    reservedToolNames: params.reservedToolNames,
    reservedChannelIds: params.reservedChannelIds,
    reservedProviderIds: params.reservedProviderIds,
    reservedEngineKinds: params.reservedEngineKinds,
    reservedNcpAgentRuntimeKinds: params.reservedNcpAgentRuntimeKinds
  });

  return {
    workspaceDir,
    ...registry
  };
}

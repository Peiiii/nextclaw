import fs from "node:fs";
import type { Config } from "@nextclaw/core";
import { normalizePluginsConfig } from "./config-state.js";
import { discoverOpenClawPlugins, type PluginCandidate } from "./discovery.js";
import { loadPluginManifest, type PluginManifest } from "./manifest.js";
import type { PluginConfigUiHint, PluginDiagnostic, PluginKind, PluginOrigin, PluginUiMetadata } from "./types.js";

type SeenIdEntry = {
  candidate: PluginCandidate;
  recordIndex: number;
};

const PLUGIN_ORIGIN_RANK: Readonly<Record<PluginOrigin, number>> = {
  config: 0,
  workspace: 1,
  global: 2,
  bundled: 3
};

function safeRealpathSync(rootDir: string, cache: Map<string, string>): string | null {
  const cached = cache.get(rootDir);
  if (cached) {
    return cached;
  }
  try {
    const resolved = fs.realpathSync(rootDir);
    cache.set(rootDir, resolved);
    return resolved;
  } catch {
    return null;
  }
}

function safeStatMtimeMs(filePath: string): number | null {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

function normalizeManifestLabel(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export type PluginManifestRecord = {
  id: string;
  name?: string;
  description?: string;
  version?: string;
  kind?: PluginKind;
  channels: string[];
  providers: string[];
  skills: string[];
  origin: PluginOrigin;
  workspaceDir?: string;
  rootDir: string;
  source: string;
  manifestPath: string;
  schemaCacheKey?: string;
  configSchema?: Record<string, unknown>;
  configUiHints?: Record<string, PluginConfigUiHint>;
};

export type PluginManifestRegistry = {
  plugins: PluginManifestRecord[];
  diagnostics: PluginDiagnostic[];
};

function buildRecord(params: {
  manifest: PluginManifest;
  candidate: PluginCandidate;
  manifestPath: string;
  schemaCacheKey?: string;
  configSchema?: Record<string, unknown>;
}): PluginManifestRecord {
  return {
    id: params.manifest.id,
    name: normalizeManifestLabel(params.manifest.name) ?? params.candidate.packageName,
    description: normalizeManifestLabel(params.manifest.description) ?? params.candidate.packageDescription,
    version: normalizeManifestLabel(params.manifest.version) ?? params.candidate.packageVersion,
    kind: params.manifest.kind,
    channels: params.manifest.channels ?? [],
    providers: params.manifest.providers ?? [],
    skills: params.manifest.skills ?? [],
    origin: params.candidate.origin,
    workspaceDir: params.candidate.workspaceDir,
    rootDir: params.candidate.rootDir,
    source: params.candidate.source,
    manifestPath: params.manifestPath,
    schemaCacheKey: params.schemaCacheKey,
    configSchema: params.configSchema,
    configUiHints: params.manifest.uiHints
  };
}

export function loadPluginManifestRegistry(params: {
  config?: Config;
  workspaceDir?: string;
  candidates?: PluginCandidate[];
  diagnostics?: PluginDiagnostic[];
}): PluginManifestRegistry {
  const normalized = normalizePluginsConfig(params.config?.plugins);

  const discovery = params.candidates
    ? {
        candidates: params.candidates,
        diagnostics: params.diagnostics ?? []
      }
    : discoverOpenClawPlugins({
        config: params.config,
        workspaceDir: params.workspaceDir,
        extraPaths: normalized.loadPaths
      });

  const diagnostics: PluginDiagnostic[] = [...discovery.diagnostics];
  const records: PluginManifestRecord[] = [];
  const seenIds = new Map<string, SeenIdEntry>();
  const realpathCache = new Map<string, string>();

  for (const candidate of discovery.candidates) {
    const manifestRes = loadPluginManifest(candidate.rootDir);
    if (!manifestRes.ok) {
      diagnostics.push({
        level: "error",
        message: manifestRes.error,
        source: manifestRes.manifestPath
      });
      continue;
    }
    const manifest = manifestRes.manifest;
    const configSchema = manifest.configSchema;

    if (candidate.idHint && candidate.idHint !== manifest.id) {
      diagnostics.push({
        level: "warn",
        pluginId: manifest.id,
        source: candidate.source,
        message: `plugin id mismatch (manifest uses "${manifest.id}", entry hints "${candidate.idHint}")`
      });
    }

    const manifestMtime = safeStatMtimeMs(manifestRes.manifestPath);
    const schemaCacheKey = manifestMtime
      ? `${manifestRes.manifestPath}:${manifestMtime}`
      : manifestRes.manifestPath;

    const existing = seenIds.get(manifest.id);
    if (existing) {
      const existingReal = safeRealpathSync(existing.candidate.rootDir, realpathCache);
      const candidateReal = safeRealpathSync(candidate.rootDir, realpathCache);
      const samePlugin = Boolean(existingReal && candidateReal && existingReal === candidateReal);

      if (samePlugin) {
        if (PLUGIN_ORIGIN_RANK[candidate.origin] < PLUGIN_ORIGIN_RANK[existing.candidate.origin]) {
          records[existing.recordIndex] = buildRecord({
            manifest,
            candidate,
            manifestPath: manifestRes.manifestPath,
            schemaCacheKey,
            configSchema
          });
          seenIds.set(manifest.id, { candidate, recordIndex: existing.recordIndex });
        }
        continue;
      }

      diagnostics.push({
        level: "warn",
        pluginId: manifest.id,
        source: candidate.source,
        message: `duplicate plugin id detected; later plugin may be overridden (${candidate.source})`
      });
    } else {
      seenIds.set(manifest.id, { candidate, recordIndex: records.length });
    }

    records.push(
      buildRecord({
        manifest,
        candidate,
        manifestPath: manifestRes.manifestPath,
        schemaCacheKey,
        configSchema
      })
    );
  }

  return {
    plugins: records,
    diagnostics
  };
}


export function toPluginUiMetadata(records: PluginManifestRecord[]): PluginUiMetadata[] {
  return records.map((record) => ({
    id: record.id,
    configSchema: record.configSchema,
    configUiHints: record.configUiHints
  }));
}

export function loadPluginUiMetadata(params: { config?: Config; workspaceDir?: string }): PluginUiMetadata[] {
  const registry = loadPluginManifestRegistry({
    config: params.config,
    workspaceDir: params.workspaceDir
  });
  return toPluginUiMetadata(registry.plugins);
}

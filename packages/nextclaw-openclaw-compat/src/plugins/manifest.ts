import fs from "node:fs";
import path from "node:path";
import type { PluginManifest, PluginManifestLoadResult } from "./types.js";
export type { PluginManifest } from "./types.js";

export const PLUGIN_MANIFEST_FILENAME = "openclaw.plugin.json";
export const PLUGIN_MANIFEST_FILENAMES = [PLUGIN_MANIFEST_FILENAME] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);
}

export function resolvePluginManifestPath(rootDir: string): string {
  for (const filename of PLUGIN_MANIFEST_FILENAMES) {
    const candidate = path.join(rootDir, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(rootDir, PLUGIN_MANIFEST_FILENAME);
}

export function loadPluginManifest(rootDir: string): PluginManifestLoadResult {
  const manifestPath = resolvePluginManifestPath(rootDir);
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, error: `plugin manifest not found: ${manifestPath}`, manifestPath };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as unknown;
  } catch (err) {
    return {
      ok: false,
      error: `failed to parse plugin manifest: ${String(err)}`,
      manifestPath
    };
  }

  if (!isRecord(raw)) {
    return { ok: false, error: "plugin manifest must be an object", manifestPath };
  }

  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) {
    return { ok: false, error: "plugin manifest requires id", manifestPath };
  }

  const configSchema = isRecord(raw.configSchema) ? raw.configSchema : null;
  if (!configSchema) {
    return { ok: false, error: "plugin manifest requires configSchema", manifestPath };
  }

  const manifest: PluginManifest = {
    id,
    configSchema,
    kind: typeof raw.kind === "string" ? raw.kind : undefined,
    channels: normalizeStringList(raw.channels),
    providers: normalizeStringList(raw.providers),
    skills: normalizeStringList(raw.skills),
    name: typeof raw.name === "string" ? raw.name.trim() : undefined,
    description: typeof raw.description === "string" ? raw.description.trim() : undefined,
    version: typeof raw.version === "string" ? raw.version.trim() : undefined,
    uiHints: isRecord(raw.uiHints) ? (raw.uiHints as Record<string, NonNullable<PluginManifest["uiHints"]>[string]>) : undefined
  };

  return { ok: true, manifest, manifestPath };
}

type OpenClawPackageManifest = {
  extensions?: string[];
  install?: {
    npmSpec?: string;
    localPath?: string;
    defaultChoice?: "npm" | "local";
  };
};

export type PackageManifest = {
  name?: string;
  version?: string;
  description?: string;
  openclaw?: OpenClawPackageManifest;
};

export function getPackageManifestMetadata(manifest: PackageManifest | undefined): OpenClawPackageManifest | undefined {
  if (!manifest) {
    return undefined;
  }
  return manifest.openclaw;
}

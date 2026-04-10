import type { Config } from "@nextclaw/core";
import {
  getPackageManifestExtensions,
  loadPluginManifest,
  type PackageManifest,
} from "../manifest.js";

export type PluginEntrySource = "production" | "development";

export function resolvePluginEntrySource(
  config: Config | undefined,
  pluginId: string | undefined,
): PluginEntrySource {
  if (!pluginId) {
    return "production";
  }
  const entry = config?.plugins?.entries?.[pluginId];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return "production";
  }
  return entry.source === "development" ? "development" : "production";
}

export function resolvePackageExtensionSelection(params: {
  dir: string;
  manifest: PackageManifest;
  config?: Config;
}): {
  extensions: string[];
  source: PluginEntrySource;
  pluginId?: string;
} {
  const pluginManifest = loadPluginManifest(params.dir);
  const pluginId = pluginManifest.ok ? pluginManifest.manifest.id : undefined;
  const source = resolvePluginEntrySource(params.config, pluginId);
  return {
    extensions: getPackageManifestExtensions(params.manifest, source),
    source,
    pluginId,
  };
}

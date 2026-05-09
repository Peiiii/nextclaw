import { existsSync, readFileSync } from "node:fs";
import type { NpmRuntimeBundleManifest } from "./npm-runtime-bundle.types.js";

function readRequiredString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${context} missing required string field: ${key}`);
  }
  return value.trim();
}

function readRequiredObject(record: Record<string, unknown>, key: string, context: string): Record<string, unknown> {
  const value = record[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} missing required object field: ${key}`);
  }
  return value as Record<string, unknown>;
}

export class NpmRuntimeBundleManifestReader {
  readFile = (filePath: string): NpmRuntimeBundleManifest => {
    if (!existsSync(filePath)) {
      throw new Error(`runtime bundle manifest not found: ${filePath}`);
    }
    return this.parse(JSON.parse(readFileSync(filePath, "utf8")), filePath);
  };

  parse = (input: unknown, context = "runtime bundle manifest"): NpmRuntimeBundleManifest => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error(`${context} must be an object`);
    }
    const record = input as Record<string, unknown>;
    const launcherCompatibility = readRequiredObject(record, "launcherCompatibility", context);
    const entrypoints = readRequiredObject(record, "entrypoints", context);
    const migrationVersion = Number(record.migrationVersion);
    if (!Number.isInteger(migrationVersion) || migrationVersion < 0) {
      throw new Error(`${context} has invalid migrationVersion`);
    }
    return {
      bundleVersion: readRequiredString(record, "bundleVersion", context),
      platform: readRequiredString(record, "platform", context),
      arch: readRequiredString(record, "arch", context),
      uiVersion: readRequiredString(record, "uiVersion", context),
      runtimeVersion: readRequiredString(record, "runtimeVersion", context),
      builtInPluginSetVersion: readRequiredString(record, "builtInPluginSetVersion", context),
      launcherCompatibility: {
        minVersion: readRequiredString(launcherCompatibility, "minVersion", `${context}.launcherCompatibility`)
      },
      entrypoints: {
        runtimeScript: readRequiredString(entrypoints, "runtimeScript", `${context}.entrypoints`)
      },
      migrationVersion
    };
  };
}

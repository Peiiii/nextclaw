import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type PackageManifest = {
  version?: string;
};

export function readNextclawPackageVersion(importMetaUrl: string): string {
  const packageJsonPath = resolve(dirname(fileURLToPath(importMetaUrl)), "../../../package.json");
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as PackageManifest;
  return typeof parsed.version === "string" ? parsed.version : "0.0.0";
}

export function resolveNextclawPackageResource(importMetaUrl: string, resourcePath: string): string {
  return resolve(dirname(fileURLToPath(importMetaUrl)), "../../../resources", resourcePath);
}

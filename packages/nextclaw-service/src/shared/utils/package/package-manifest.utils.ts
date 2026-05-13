import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPackageVersion as getCorePackageVersion } from "@nextclaw/core";

type PackageManifestView = {
  name?: string;
  version?: string;
};

function readPackageManifest(pkgPath: string): PackageManifestView | null {
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageManifestView;
  } catch {
    return null;
  }
}

function findNearestPackageVersion(startDir: string, expectedName?: string): string | undefined {
  let current = resolve(startDir);
  while (current.length > 0) {
    const parsed = readPackageManifest(join(current, "package.json"));
    const matchesExpectedName = parsed && (!expectedName || parsed.name === expectedName);
    if (matchesExpectedName) {
      return typeof parsed.version === "string" ? parsed.version : undefined;
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return undefined;
}

function findWorkspacePackageVersion(startDir: string, packageName: string): string | undefined {
  let current = resolve(startDir);
  while (current.length > 0) {
    const rootDir = join(current, "packages", packageName);
    const parsed = readPackageManifest(join(rootDir, "package.json"));
    if (parsed?.name === packageName) {
      return typeof parsed.version === "string" ? parsed.version : undefined;
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return undefined;
}

export function getPackageVersion(importMetaUrl = import.meta.url): string {
  const cliDir = resolve(fileURLToPath(new URL(".", importMetaUrl)));
  const packageVersion =
    findNearestPackageVersion(cliDir, "nextclaw") ??
    findWorkspacePackageVersion(cliDir, "nextclaw") ??
    findNearestPackageVersion(cliDir);
  return packageVersion ?? getCorePackageVersion();
}

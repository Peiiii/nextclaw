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
    const raw = readFileSync(pkgPath, "utf-8");
    return JSON.parse(raw) as PackageManifestView;
  } catch {
    return null;
  }
}

export function findNearestPackageManifest(
  startDir: string,
  expectedName?: string
): { rootDir: string; version?: string } | null {
  let current = resolve(startDir);
  while (current.length > 0) {
    const parsed = readPackageManifest(join(current, "package.json"));
    const matchesExpectedName = parsed && (!expectedName || parsed.name === expectedName);
    if (matchesExpectedName) {
      return {
        rootDir: current,
        version: typeof parsed.version === "string" ? parsed.version : undefined
      };
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

function findWorkspacePackageManifest(
  startDir: string,
  packageName: string
): { rootDir: string; version?: string } | null {
  let current = resolve(startDir);
  while (current.length > 0) {
    const rootDir = join(current, "packages", packageName);
    const parsed = readPackageManifest(join(rootDir, "package.json"));
    if (parsed?.name === packageName) {
      return {
        rootDir,
        version: typeof parsed.version === "string" ? parsed.version : undefined
      };
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

export function getPackageVersion(importMetaUrl = import.meta.url): string {
  const cliDir = resolve(fileURLToPath(new URL(".", importMetaUrl)));
  const packageVersion =
    findNearestPackageManifest(cliDir, "nextclaw")?.version ??
    findWorkspacePackageManifest(cliDir, "nextclaw")?.version ??
    findNearestPackageManifest(cliDir)?.version;
  return packageVersion ?? getCorePackageVersion();
}

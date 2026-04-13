import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRootCache = new Map();

function hasWorkspacePackageJson(directoryPath) {
  const packageJsonPath = resolve(directoryPath, "package.json");
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (Array.isArray(packageJson.workspaces)) {
      return true;
    }
    if (packageJson.workspaces && Array.isArray(packageJson.workspaces.packages)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isRepoRootDirectory(directoryPath) {
  return (
    existsSync(resolve(directoryPath, "pnpm-workspace.yaml")) ||
    hasWorkspacePackageJson(directoryPath)
  );
}

export function findRepoRoot(importMetaUrl) {
  const cacheKey = String(importMetaUrl);
  const cachedRoot = repoRootCache.get(cacheKey);
  if (cachedRoot) {
    return cachedRoot;
  }

  let currentDir = dirname(fileURLToPath(importMetaUrl));
  while (true) {
    if (isRepoRootDirectory(currentDir)) {
      repoRootCache.set(cacheKey, currentDir);
      return currentDir;
    }

    const parentDir = resolve(currentDir, "..");
    if (parentDir === currentDir) {
      throw new Error(`Unable to locate repo root from ${fileURLToPath(importMetaUrl)}`);
    }
    currentDir = parentDir;
  }
}

export function resolveRepoPath(importMetaUrl, ...segments) {
  return resolve(findRepoRoot(importMetaUrl), ...segments);
}

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

function collectExportStringValues(value: unknown, values: string[]): void {
  if (typeof value === "string") {
    values.push(value);
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  for (const child of Object.values(value)) {
    collectExportStringValues(child, values);
  }
}

function resolveLocalPackageDir(pluginRoot: string, packageName: string): string {
  const segments = packageName.split("/");
  return path.join(pluginRoot, "node_modules", ...segments);
}

function findPackageRoot(startPath: string): string | null {
  let cursor = path.dirname(startPath);
  for (let i = 0; i < 8; i += 1) {
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
  return null;
}

function resolveWorkspaceSourceEntry(packageDir: string): string | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  const candidates = [
    "src/index.ts",
    "src/index.tsx",
    "src/index.mts",
    "src/index.cts",
    "src/index.js",
    "src/index.mjs",
    "src/index.cjs",
  ];
  for (const candidate of candidates) {
    const resolved = path.join(packageDir, candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return null;
}

function safeRealpath(filePath: string): string | null {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return null;
  }
}

function isRunnableEntryFile(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  if (normalized.endsWith(".d.ts") || normalized.endsWith(".map")) {
    return false;
  }
  return fs.existsSync(filePath);
}

function hasRunnableLocalPackage(pluginRoot: string, packageName: string): boolean {
  try {
    const packageDir = resolveLocalPackageDir(pluginRoot, packageName);
    const packageJsonPath = path.join(packageDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as {
      exports?: unknown;
      module?: unknown;
      main?: unknown;
    };
    const entryCandidates: string[] = [];
    collectExportStringValues(packageJson.exports, entryCandidates);
    if (typeof packageJson.module === "string") {
      entryCandidates.push(packageJson.module);
    }
    if (typeof packageJson.main === "string") {
      entryCandidates.push(packageJson.main);
    }
    if (entryCandidates.length === 0) {
      entryCandidates.push("index.js", "index.mjs", "index.cjs");
    }
    return entryCandidates.some((candidate) => {
      const resolved = path.resolve(packageDir, candidate);
      return (
        resolved.startsWith(`${path.resolve(packageDir)}${path.sep}`) &&
        isRunnableEntryFile(resolved)
      );
    });
  } catch {
    return false;
  }
}

function readScopeEntries(scopeDir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(scopeDir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isAliasablePackageEntry(entry: fs.Dirent): boolean {
  return entry.isDirectory() || entry.isSymbolicLink();
}

function shouldAliasHostPackage(pluginRoot: string | undefined, packageName: string): boolean {
  return !pluginRoot || !hasRunnableLocalPackage(pluginRoot, packageName);
}

function resolveHostPackageAliasTarget(
  require: NodeRequire,
  packageName: string,
): string | null {
  try {
    const resolvedEntry = require.resolve(packageName);
    const packageDir = findPackageRoot(resolvedEntry);
    if (!packageDir) {
      return resolvedEntry;
    }
    return resolveWorkspaceSourceEntry(packageDir) ?? resolvedEntry;
  } catch {
    return null;
  }
}

function shouldPreferWorkspaceSourceAlias(
  pluginRoot: string | undefined,
  packageName: string,
  hostAliasTarget: string,
): boolean {
  if (!pluginRoot || process.env.NODE_ENV === "production") {
    return false;
  }
  const localRealpath = safeRealpath(resolveLocalPackageDir(pluginRoot, packageName));
  const hostPackageDir = findPackageRoot(hostAliasTarget);
  if (!localRealpath || !hostPackageDir) {
    return false;
  }
  return localRealpath === hostPackageDir && resolveWorkspaceSourceEntry(hostPackageDir) !== null;
}

function appendScopeAliases(params: {
  aliases: Record<string, string>;
  scopeDir: string;
  scope: string;
  pluginRoot?: string;
  require: NodeRequire;
}): void {
  for (const entry of readScopeEntries(params.scopeDir)) {
    if (!isAliasablePackageEntry(entry)) {
      continue;
    }
    const packageName = `${params.scope}/${entry.name}`;
    const hostAliasTarget = resolveHostPackageAliasTarget(params.require, packageName);
    if (!hostAliasTarget) {
      continue;
    }
    const useHostAlias =
      shouldAliasHostPackage(params.pluginRoot, packageName) ||
      shouldPreferWorkspaceSourceAlias(
        params.pluginRoot,
        packageName,
        hostAliasTarget,
      );
    if (!useHostAlias) {
      continue;
    }
    params.aliases[packageName] = hostAliasTarget;
  }
}

export function buildWorkspaceHostPackageAliases(params: {
  scope: string;
  pluginRoot?: string;
}): Record<string, string> {
  const aliases: Record<string, string> = {};
  const require = createRequire(import.meta.url);
  let cursor = path.dirname(fileURLToPath(import.meta.url));

  for (let i = 0; i < 8; i += 1) {
    const scopeDirs = [
      path.join(cursor, "node_modules", params.scope),
      path.join(cursor, "node_modules", ".pnpm", "node_modules", params.scope),
    ];
    for (const scopeDir of scopeDirs) {
      if (!fs.existsSync(scopeDir)) {
        continue;
      }
      appendScopeAliases({
        aliases,
        scopeDir,
        scope: params.scope,
        pluginRoot: params.pluginRoot,
        require,
      });
    }

    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  return aliases;
}

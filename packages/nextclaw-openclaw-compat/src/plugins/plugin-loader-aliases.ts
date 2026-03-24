import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

function resolvePluginSdkAliasFile(params: { srcFile: string; distFile: string }): string | null {
  try {
    const modulePath = fileURLToPath(import.meta.url);
    const isProduction = process.env.NODE_ENV === "production";
    let cursor = path.dirname(modulePath);
    for (let i = 0; i < 6; i += 1) {
      const srcCandidate = path.join(cursor, "src", "plugin-sdk", params.srcFile);
      const distCandidate = path.join(cursor, "dist", "plugin-sdk", params.distFile);
      const candidates = isProduction ? [distCandidate, srcCandidate] : [srcCandidate, distCandidate];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
      const parent = path.dirname(cursor);
      if (parent === cursor) {
        break;
      }
      cursor = parent;
    }
  } catch {
    return null;
  }
  return null;
}

function resolvePluginSdkAlias(): string | null {
  return resolvePluginSdkAliasFile({ srcFile: "index.ts", distFile: "index.js" });
}

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
      return resolved.startsWith(`${path.resolve(packageDir)}${path.sep}`) && isRunnableEntryFile(resolved);
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
    if (!shouldAliasHostPackage(params.pluginRoot, packageName)) {
      continue;
    }
    try {
      params.aliases[packageName] = params.require.resolve(packageName);
    } catch {
      // Ignore packages that are not resolvable from the current host runtime.
    }
  }
}

function buildScopedPackageAliases(scope: string, pluginRoot?: string): Record<string, string> {
  const aliases: Record<string, string> = {};
  const require = createRequire(import.meta.url);
  let cursor = path.dirname(fileURLToPath(import.meta.url));

  for (let i = 0; i < 8; i += 1) {
    const scopeDir = path.join(cursor, "node_modules", scope);
    if (fs.existsSync(scopeDir)) {
      appendScopeAliases({ aliases, scopeDir, scope, pluginRoot, require });
    }

    const parent = path.dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  return aliases;
}

export function buildPluginLoaderAliases(pluginRoot?: string): Record<string, string> {
  const aliases = buildScopedPackageAliases("@nextclaw", pluginRoot);
  const pluginSdkAlias = resolvePluginSdkAlias();
  if (pluginSdkAlias) {
    aliases["openclaw/plugin-sdk"] = pluginSdkAlias;
  }
  return aliases;
}

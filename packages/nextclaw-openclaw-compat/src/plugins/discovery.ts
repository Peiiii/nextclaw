import fs from "node:fs";
import path from "node:path";
import type { Config } from "@nextclaw/core";
import { expandHome, getDataPath } from "@nextclaw/core";
import { getPackageManifestMetadata, type PackageManifest } from "./manifest.js";
import type { PluginDiagnostic, PluginOrigin } from "./types.js";

const EXTENSION_EXTS = new Set([".ts", ".js", ".mts", ".cts", ".mjs", ".cjs"]);

export type PluginCandidate = {
  idHint: string;
  source: string;
  rootDir: string;
  origin: PluginOrigin;
  workspaceDir?: string;
  packageName?: string;
  packageVersion?: string;
  packageDescription?: string;
  packageDir?: string;
};

export type PluginDiscoveryResult = {
  candidates: PluginCandidate[];
  diagnostics: PluginDiagnostic[];
};

function resolveUserPath(input: string): string {
  return path.resolve(expandHome(input));
}

function isExtensionFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (!EXTENSION_EXTS.has(ext)) {
    return false;
  }
  return !filePath.endsWith(".d.ts");
}

function readPackageManifest(dir: string): PackageManifest | null {
  const manifestPath = path.join(dir, "package.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as PackageManifest;
  } catch {
    return null;
  }
}

function resolvePackageExtensions(manifest: PackageManifest): string[] {
  const raw = getPackageManifestMetadata(manifest)?.extensions;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);
}

function deriveIdHint(params: { filePath: string; packageName?: string; hasMultipleExtensions: boolean }): string {
  const base = path.basename(params.filePath, path.extname(params.filePath));
  const packageName = params.packageName?.trim();
  if (!packageName) {
    return base;
  }
  const unscoped = packageName.includes("/") ? (packageName.split("/").pop() ?? packageName) : packageName;
  if (!params.hasMultipleExtensions) {
    return unscoped;
  }
  return `${unscoped}/${base}`;
}

function addCandidate(params: {
  candidates: PluginCandidate[];
  seen: Set<string>;
  idHint: string;
  source: string;
  rootDir: string;
  origin: PluginOrigin;
  workspaceDir?: string;
  manifest?: PackageManifest | null;
  packageDir?: string;
}) {
  const resolvedSource = path.resolve(params.source);
  if (params.seen.has(resolvedSource)) {
    return;
  }
  params.seen.add(resolvedSource);
  const manifest = params.manifest ?? null;
  params.candidates.push({
    idHint: params.idHint,
    source: resolvedSource,
    rootDir: path.resolve(params.rootDir),
    origin: params.origin,
    workspaceDir: params.workspaceDir,
    packageName: manifest?.name?.trim() || undefined,
    packageVersion: manifest?.version?.trim() || undefined,
    packageDescription: manifest?.description?.trim() || undefined,
    packageDir: params.packageDir
  });
}

function discoverInDirectory(params: {
  dir: string;
  origin: PluginOrigin;
  workspaceDir?: string;
  candidates: PluginCandidate[];
  diagnostics: PluginDiagnostic[];
  seen: Set<string>;
}) {
  if (!fs.existsSync(params.dir)) {
    return;
  }
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(params.dir, { withFileTypes: true });
  } catch (err) {
    params.diagnostics.push({
      level: "warn",
      message: `failed to read extensions dir: ${params.dir} (${String(err)})`,
      source: params.dir
    });
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(params.dir, entry.name);
    if (entry.isFile()) {
      if (!isExtensionFile(fullPath)) {
        continue;
      }
      addCandidate({
        candidates: params.candidates,
        seen: params.seen,
        idHint: path.basename(entry.name, path.extname(entry.name)),
        source: fullPath,
        rootDir: path.dirname(fullPath),
        origin: params.origin,
        workspaceDir: params.workspaceDir
      });
      continue;
    }

    if (!entry.isDirectory()) {
      continue;
    }

    const manifest = readPackageManifest(fullPath);
    const extensions = manifest ? resolvePackageExtensions(manifest) : [];
    if (extensions.length > 0) {
      for (const extPath of extensions) {
        const resolved = path.resolve(fullPath, extPath);
        addCandidate({
          candidates: params.candidates,
          seen: params.seen,
          idHint: deriveIdHint({
            filePath: resolved,
            packageName: manifest?.name,
            hasMultipleExtensions: extensions.length > 1
          }),
          source: resolved,
          rootDir: fullPath,
          origin: params.origin,
          workspaceDir: params.workspaceDir,
          manifest,
          packageDir: fullPath
        });
      }
      continue;
    }

    const indexCandidates = ["index.ts", "index.js", "index.mjs", "index.cjs"];
    const indexFile = indexCandidates.map((candidate) => path.join(fullPath, candidate)).find((candidate) => fs.existsSync(candidate));
    if (indexFile && isExtensionFile(indexFile)) {
      addCandidate({
        candidates: params.candidates,
        seen: params.seen,
        idHint: entry.name,
        source: indexFile,
        rootDir: fullPath,
        origin: params.origin,
        workspaceDir: params.workspaceDir,
        manifest,
        packageDir: fullPath
      });
    }
  }
}

function discoverFromPath(params: {
  rawPath: string;
  origin: PluginOrigin;
  workspaceDir?: string;
  candidates: PluginCandidate[];
  diagnostics: PluginDiagnostic[];
  seen: Set<string>;
}) {
  const resolved = resolveUserPath(params.rawPath);
  if (!fs.existsSync(resolved)) {
    params.diagnostics.push({
      level: "error",
      message: `plugin path not found: ${resolved}`,
      source: resolved
    });
    return;
  }

  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    if (!isExtensionFile(resolved)) {
      params.diagnostics.push({
        level: "error",
        message: `plugin path is not a supported file: ${resolved}`,
        source: resolved
      });
      return;
    }
    addCandidate({
      candidates: params.candidates,
      seen: params.seen,
      idHint: path.basename(resolved, path.extname(resolved)),
      source: resolved,
      rootDir: path.dirname(resolved),
      origin: params.origin,
      workspaceDir: params.workspaceDir
    });
    return;
  }

  if (stat.isDirectory()) {
    const manifest = readPackageManifest(resolved);
    const extensions = manifest ? resolvePackageExtensions(manifest) : [];

    if (extensions.length > 0) {
      for (const extPath of extensions) {
        const source = path.resolve(resolved, extPath);
        addCandidate({
          candidates: params.candidates,
          seen: params.seen,
          idHint: deriveIdHint({
            filePath: source,
            packageName: manifest?.name,
            hasMultipleExtensions: extensions.length > 1
          }),
          source,
          rootDir: resolved,
          origin: params.origin,
          workspaceDir: params.workspaceDir,
          manifest,
          packageDir: resolved
        });
      }
      return;
    }

    const indexCandidates = ["index.ts", "index.js", "index.mjs", "index.cjs"];
    const indexFile = indexCandidates.map((candidate) => path.join(resolved, candidate)).find((candidate) => fs.existsSync(candidate));
    if (indexFile && isExtensionFile(indexFile)) {
      addCandidate({
        candidates: params.candidates,
        seen: params.seen,
        idHint: path.basename(resolved),
        source: indexFile,
        rootDir: resolved,
        origin: params.origin,
        workspaceDir: params.workspaceDir,
        manifest,
        packageDir: resolved
      });
      return;
    }

    discoverInDirectory({
      dir: resolved,
      origin: params.origin,
      workspaceDir: params.workspaceDir,
      candidates: params.candidates,
      diagnostics: params.diagnostics,
      seen: params.seen
    });
  }
}

export function discoverOpenClawPlugins(params: {
  config?: Config;
  workspaceDir?: string;
  extraPaths?: string[];
}): PluginDiscoveryResult {
  const candidates: PluginCandidate[] = [];
  const diagnostics: PluginDiagnostic[] = [];
  const seen = new Set<string>();

  const workspaceDir = params.workspaceDir?.trim();
  const loadPaths = params.extraPaths ?? params.config?.plugins?.load?.paths ?? [];

  for (const rawPath of loadPaths) {
    if (typeof rawPath !== "string") {
      continue;
    }
    const trimmed = rawPath.trim();
    if (!trimmed) {
      continue;
    }
    discoverFromPath({
      rawPath: trimmed,
      origin: "config",
      workspaceDir,
      candidates,
      diagnostics,
      seen
    });
  }

  if (workspaceDir) {
    discoverInDirectory({
      dir: path.join(workspaceDir, ".nextclaw", "extensions"),
      origin: "workspace",
      workspaceDir,
      candidates,
      diagnostics,
      seen
    });
  }

  discoverInDirectory({
    dir: path.join(getDataPath(), "extensions"),
    origin: "global",
    candidates,
    diagnostics,
    seen
  });

  return { candidates, diagnostics };
}

import fs from "node:fs";
import path from "node:path";
import type { Config } from "@nextclaw/core";
import { expandHome, getDataPath } from "@nextclaw/core";
import type { PackageManifest } from "./manifest.js";
import { discoverPackageDirectoryEntry } from "./development-source/package-directory.js";
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

function collectConfiguredInstallPaths(config?: Config): string[] {
  if (!config?.plugins?.installs) {
    return [];
  }

  const paths: string[] = [];
  for (const installRecord of Object.values(config.plugins.installs)) {
    if (!installRecord || typeof installRecord !== "object") {
      continue;
    }
    const installPath = typeof installRecord.installPath === "string" ? installRecord.installPath.trim() : "";
    if (!installPath || paths.includes(installPath)) {
      continue;
    }
    paths.push(installPath);
  }

  return paths;
}

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
  config?: Config;
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

    void discoverPackageDirectoryEntry({
      fullPath,
      idHint: entry.name,
      origin: params.origin,
      config: params.config,
      workspaceDir: params.workspaceDir,
      diagnostics: params.diagnostics,
      isExtensionFile,
      addCandidate: (candidate) =>
        addCandidate({
          candidates: params.candidates,
          seen: params.seen,
          ...candidate,
        }),
    });
  }
}

function discoverFromPath(params: {
  rawPath: string;
  origin: PluginOrigin;
  config?: Config;
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
    if (discoverPackageDirectoryEntry({
      fullPath: resolved,
      idHint: path.basename(resolved),
      origin: params.origin,
      config: params.config,
      workspaceDir: params.workspaceDir,
      diagnostics: params.diagnostics,
      isExtensionFile,
      addCandidate: (candidate) =>
        addCandidate({
          candidates: params.candidates,
          seen: params.seen,
          ...candidate,
        }),
    })) {
      return;
    }

    discoverInDirectory({
      dir: resolved,
      origin: params.origin,
      config: params.config,
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
  const configuredLoadPaths = params.extraPaths ?? params.config?.plugins?.load?.paths ?? [];
  const loadPaths = [...configuredLoadPaths, ...collectConfiguredInstallPaths(params.config)];

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
      config: params.config,
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
      config: params.config,
      workspaceDir,
      candidates,
      diagnostics,
      seen
    });
  }

  discoverInDirectory({
    dir: path.join(getDataPath(), "extensions"),
    origin: "global",
    config: params.config,
    candidates,
    diagnostics,
    seen
  });

  return { candidates, diagnostics };
}

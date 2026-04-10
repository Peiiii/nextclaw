import fs from "node:fs";
import path from "node:path";
import type { Config } from "@nextclaw/core";
import { resolvePackageExtensionSelection } from "./entry-selection.js";
import type { PackageManifest } from "../manifest.js";
import type { PluginDiagnostic, PluginOrigin } from "../types.js";

type AddCandidateFn = (params: {
  idHint: string;
  source: string;
  rootDir: string;
  origin: PluginOrigin;
  workspaceDir?: string;
  manifest?: PackageManifest | null;
  packageDir?: string;
}) => void;

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

function deriveIdHint(params: {
  filePath: string;
  packageName?: string;
  hasMultipleExtensions: boolean;
}): string {
  const base = path.basename(params.filePath, path.extname(params.filePath));
  const packageName = params.packageName?.trim();
  if (!packageName) {
    return base;
  }
  const unscoped = packageName.includes("/")
    ? (packageName.split("/").pop() ?? packageName)
    : packageName;
  if (!params.hasMultipleExtensions) {
    return unscoped;
  }
  return `${unscoped}/${base}`;
}

function addPackageExtensionCandidates(params: {
  extensions: string[];
  fullPath: string;
  manifest: PackageManifest | null;
  origin: PluginOrigin;
  workspaceDir?: string;
  addCandidate: AddCandidateFn;
}) {
  for (const extPath of params.extensions) {
    const resolved = path.resolve(params.fullPath, extPath);
    params.addCandidate({
      idHint: deriveIdHint({
        filePath: resolved,
        packageName: params.manifest?.name,
        hasMultipleExtensions: params.extensions.length > 1,
      }),
      source: resolved,
      rootDir: params.fullPath,
      origin: params.origin,
      workspaceDir: params.workspaceDir,
      manifest: params.manifest,
      packageDir: params.fullPath,
    });
  }
}

function addDirectoryIndexCandidate(params: {
  fullPath: string;
  idHint: string;
  manifest: PackageManifest | null;
  origin: PluginOrigin;
  workspaceDir?: string;
  isExtensionFile: (filePath: string) => boolean;
  addCandidate: AddCandidateFn;
}) {
  const indexCandidates = ["index.ts", "index.js", "index.mjs", "index.cjs"];
  const indexFile = indexCandidates
    .map((candidate) => path.join(params.fullPath, candidate))
    .find((candidate) => fs.existsSync(candidate));
  if (!indexFile || !params.isExtensionFile(indexFile)) {
    return false;
  }
  params.addCandidate({
    idHint: params.idHint,
    source: indexFile,
    rootDir: params.fullPath,
    origin: params.origin,
    workspaceDir: params.workspaceDir,
    manifest: params.manifest,
    packageDir: params.fullPath,
  });
  return true;
}

function addMissingDevelopmentEntryDiagnostic(
  diagnostics: PluginDiagnostic[],
  fullPath: string,
  pluginId: string | undefined,
): void {
  diagnostics.push({
    level: "error",
    pluginId,
    source: path.join(fullPath, "package.json"),
    message:
      "plugin is configured to load development source, but openclaw.development.extensions is missing",
  });
}

export function discoverPackageDirectoryEntry(params: {
  fullPath: string;
  idHint: string;
  origin: PluginOrigin;
  config?: Config;
  workspaceDir?: string;
  diagnostics: PluginDiagnostic[];
  isExtensionFile: (filePath: string) => boolean;
  addCandidate: AddCandidateFn;
}): boolean {
  const manifest = readPackageManifest(params.fullPath);
  const packageSelection = manifest
    ? resolvePackageExtensionSelection({
        dir: params.fullPath,
        manifest,
        config: params.config,
      })
    : null;
  const extensions = packageSelection?.extensions ?? [];
  if (packageSelection?.source === "development" && extensions.length === 0) {
    addMissingDevelopmentEntryDiagnostic(
      params.diagnostics,
      params.fullPath,
      packageSelection.pluginId,
    );
  }
  if (extensions.length > 0) {
    addPackageExtensionCandidates({
      extensions,
      fullPath: params.fullPath,
      manifest,
      origin: params.origin,
      workspaceDir: params.workspaceDir,
      addCandidate: params.addCandidate,
    });
    return true;
  }
  if (packageSelection?.source === "development") {
    return true;
  }
  return addDirectoryIndexCandidate({
    fullPath: params.fullPath,
    idHint: params.idHint,
    manifest,
    origin: params.origin,
    workspaceDir: params.workspaceDir,
    isExtensionFile: params.isExtensionFile,
    addCandidate: params.addCandidate,
  });
}

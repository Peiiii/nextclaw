import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "@nextclaw/core";

type WorkspacePluginPackage = {
  packageName: string;
  dir: string;
  supportsDevelopmentSource: boolean;
};

const readJsonFile = (filePath: string): Record<string, unknown> | null => {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
};

export const resolveDevFirstPartyPluginDir = (
  explicitDir: string | undefined,
  moduleDir = path.dirname(fileURLToPath(import.meta.url)),
): string | undefined => {
  const configured = explicitDir?.trim();
  if (configured) {
    return configured;
  }

  const inferred = path.resolve(moduleDir, "../../../../../extensions");
  return fs.existsSync(inferred) ? inferred : undefined;
};

const hasOpenClawExtensions = (pkg: Record<string, unknown>): boolean => {
  const openclaw = pkg.openclaw;
  if (!openclaw || typeof openclaw !== "object" || Array.isArray(openclaw)) {
    return false;
  }
  const extensions = (openclaw as Record<string, unknown>).extensions;
  return (
    Array.isArray(extensions) &&
    extensions.some((entry) => typeof entry === "string" && entry.trim().length > 0)
  );
};

const hasOpenClawDevelopmentExtensions = (
  pkg: Record<string, unknown>,
): boolean => {
  const openclaw = pkg.openclaw;
  if (!openclaw || typeof openclaw !== "object" || Array.isArray(openclaw)) {
    return false;
  }
  const development = (openclaw as Record<string, unknown>).development;
  if (!development || typeof development !== "object" || Array.isArray(development)) {
    return false;
  }
  const extensions = (development as Record<string, unknown>).extensions;
  return (
    Array.isArray(extensions) &&
    extensions.some((entry) => typeof entry === "string" && entry.trim().length > 0)
  );
};

const normalizePackageSpec = (spec: string): string | undefined => {
  const trimmed = spec.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("@")) {
    const slashIndex = trimmed.indexOf("/");
    if (slashIndex < 0) {
      return undefined;
    }
    const secondAtIndex = trimmed.indexOf("@", slashIndex + 1);
    return secondAtIndex < 0 ? trimmed : trimmed.slice(0, secondAtIndex);
  }
  const versionIndex = trimmed.indexOf("@");
  return versionIndex < 0 ? trimmed : trimmed.slice(0, versionIndex);
};

const readWorkspacePluginPackages = (
  workspaceExtensionsDir: string,
): WorkspacePluginPackage[] => {
  if (!workspaceExtensionsDir.trim() || !fs.existsSync(workspaceExtensionsDir)) {
    return [];
  }

  const entries = fs.readdirSync(workspaceExtensionsDir, { withFileTypes: true });
  const packages: WorkspacePluginPackage[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packageDir = path.join(workspaceExtensionsDir, entry.name);
    const pkg = readJsonFile(path.join(packageDir, "package.json"));
    if (!pkg || !hasOpenClawExtensions(pkg)) {
      continue;
    }
    const packageName = readString(pkg.name);
    if (!packageName?.startsWith("@nextclaw/")) {
      continue;
    }
    packages.push({
      packageName,
      dir: packageDir,
      supportsDevelopmentSource: hasOpenClawDevelopmentExtensions(pkg),
    });
  }
  return packages;
};

const mergeLoadPaths = (existingLoadPaths: string[], devLoadPaths: string[]): string[] => {
  const mergedLoadPaths = [...devLoadPaths];
  for (const entry of existingLoadPaths) {
    if (!mergedLoadPaths.includes(entry)) {
      mergedLoadPaths.push(entry);
    }
  }
  return mergedLoadPaths;
};

const buildDevelopmentSourceEntryDefaults = (
  config: Config,
  workspacePackages: WorkspacePluginPackage[],
): {
  didDefaultDevelopmentSource: boolean;
  nextEntries: NonNullable<Config["plugins"]["entries"]>;
} => {
  const packageByName = new Map(
    workspacePackages.map((entry) => [entry.packageName, entry]),
  );
  const nextEntries = { ...(config.plugins.entries ?? {}) };
  let didDefaultDevelopmentSource = false;

  for (const [pluginId, installRecord] of Object.entries(config.plugins.installs ?? {})) {
    const packageName = normalizePackageSpec(installRecord.spec ?? "");
    if (!packageName) {
      continue;
    }
    const workspacePackage = packageByName.get(packageName);
    if (!workspacePackage?.supportsDevelopmentSource) {
      continue;
    }
    const existingEntry = nextEntries[pluginId];
    if (existingEntry?.source) {
      continue;
    }
    nextEntries[pluginId] = {
      ...existingEntry,
      source: "development",
    };
    didDefaultDevelopmentSource = true;
  }

  return {
    didDefaultDevelopmentSource,
    nextEntries,
  };
};

export const resolveDevFirstPartyPluginLoadPaths = (
  config: Config,
  workspaceExtensionsDir: string | undefined,
): string[] => {
  const rootDir = resolveDevFirstPartyPluginDir(workspaceExtensionsDir);
  if (!rootDir) {
    return [];
  }

  const workspacePackages = readWorkspacePluginPackages(rootDir);
  if (workspacePackages.length === 0) {
    return [];
  }

  const packageDirByName = new Map(
    workspacePackages.map((entry) => [entry.packageName, entry.dir]),
  );
  const loadPaths: string[] = [];
  const installs = config.plugins.installs ?? {};

  for (const installRecord of Object.values(installs)) {
    const packageName = normalizePackageSpec(installRecord.spec ?? "");
    if (!packageName) {
      continue;
    }
    const packageDir = packageDirByName.get(packageName);
    if (!packageDir || loadPaths.includes(packageDir)) {
      continue;
    }
    loadPaths.push(packageDir);
  }

  return loadPaths;
};

export const resolveDevFirstPartyPluginInstallRoots = (
  config: Config,
  workspaceExtensionsDir: string | undefined,
): string[] => {
  const rootDir = resolveDevFirstPartyPluginDir(workspaceExtensionsDir);
  if (!rootDir) {
    return [];
  }

  const workspacePackages = readWorkspacePluginPackages(rootDir);
  if (workspacePackages.length === 0) {
    return [];
  }

  const packageNames = new Set(
    workspacePackages.map((entry) => entry.packageName),
  );
  const installRoots: string[] = [];

  for (const installRecord of Object.values(config.plugins.installs ?? {})) {
    const packageName = normalizePackageSpec(installRecord.spec ?? "");
    if (!packageName || !packageNames.has(packageName)) {
      continue;
    }
    const installPath = readString(installRecord.installPath);
    if (!installPath || installRoots.includes(installPath)) {
      continue;
    }
    installRoots.push(installPath);
  }

  return installRoots;
};

export const applyDevFirstPartyPluginLoadPaths = (
  config: Config,
  workspaceExtensionsDir: string | undefined,
): Config => {
  const rootDir = resolveDevFirstPartyPluginDir(workspaceExtensionsDir);
  if (!rootDir) {
    return config;
  }
  const workspacePackages = readWorkspacePluginPackages(rootDir);
  if (workspacePackages.length === 0) {
    return config;
  }

  const devLoadPaths = resolveDevFirstPartyPluginLoadPaths(config, rootDir);
  if (devLoadPaths.length === 0) {
    return config;
  }
  const existingLoadPaths = Array.isArray(config.plugins.load?.paths)
    ? config.plugins.load.paths.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : [];
  const mergedLoadPaths = mergeLoadPaths(existingLoadPaths, devLoadPaths);
  const { didDefaultDevelopmentSource, nextEntries } =
    buildDevelopmentSourceEntryDefaults(config, workspacePackages);

  return {
    ...config,
    plugins: {
      ...config.plugins,
      entries: didDefaultDevelopmentSource ? nextEntries : config.plugins.entries,
      load: {
        ...config.plugins.load,
        paths: mergedLoadPaths,
      },
    },
  };
};

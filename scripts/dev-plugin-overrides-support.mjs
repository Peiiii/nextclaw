import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

function readOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function ensureDirectoryExists(dirPath) {
  return existsSync(dirPath) && statSync(dirPath).isDirectory();
}

function collectLatestMtimeMs(targetPath) {
  if (!existsSync(targetPath)) {
    return null;
  }
  const stats = statSync(targetPath);
  if (!stats.isDirectory()) {
    return stats.mtimeMs;
  }

  let latest = null;
  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    const entryPath = join(targetPath, entry.name);
    const entryMtime = collectLatestMtimeMs(entryPath);
    if (entryMtime !== null && (latest === null || entryMtime > latest)) {
      latest = entryMtime;
    }
  }
  return latest;
}

function getManifestPaths(pluginPath) {
  return {
    packageJsonPath: join(pluginPath, "package.json"),
    pluginManifestPath: join(pluginPath, "openclaw.plugin.json"),
  };
}

function readPluginPackage(pluginPath) {
  const { packageJsonPath, pluginManifestPath } = getManifestPaths(pluginPath);
  if (!existsSync(packageJsonPath)) {
    throw new Error(`Plugin package.json not found: ${packageJsonPath}`);
  }
  if (!existsSync(pluginManifestPath)) {
    throw new Error(`Plugin manifest not found: ${pluginManifestPath}`);
  }

  const packageJson = readJsonFile(packageJsonPath);
  const pluginManifest = readJsonFile(pluginManifestPath);
  const pluginId = readOptionalString(pluginManifest?.id);
  if (!pluginId) {
    throw new Error(`Plugin manifest requires id: ${pluginManifestPath}`);
  }

  return {
    packageJsonPath,
    pluginManifestPath,
    packageJson,
    pluginManifest,
    pluginId,
  };
}

function readExtensionEntries(packageJson, source) {
  const openclaw = packageJson?.openclaw;
  const entries = source === "development" ? openclaw?.development?.extensions : openclaw?.extensions;
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map((entry) => readOptionalString(entry))
    .filter((entry) => Boolean(entry));
}

function collectSourceWatchPaths(pluginPath) {
  const sourcePaths = [
    join(pluginPath, "package.json"),
    join(pluginPath, "openclaw.plugin.json"),
  ];
  const sourceDir = join(pluginPath, "src");
  if (ensureDirectoryExists(sourceDir)) {
    sourcePaths.push(sourceDir);
  }
  return sourcePaths;
}

export function inspectProductionBuildStatus(pluginPath) {
  const normalizedPluginPath = resolve(pluginPath);
  const { packageJson, packageJsonPath, pluginManifestPath } = readPluginPackage(normalizedPluginPath);
  const productionEntries = readExtensionEntries(packageJson, "production");
  if (productionEntries.length === 0) {
    return {
      stale: false,
      reason: null,
      missingEntries: [],
      newestSourceMtimeMs: null,
      oldestDistMtimeMs: null,
    };
  }

  const entryPaths = productionEntries.map((entry) => resolve(normalizedPluginPath, entry));
  const missingEntries = entryPaths.filter((entryPath) => !existsSync(entryPath));
  if (missingEntries.length > 0) {
    return {
      stale: true,
      reason: `missing production build output: ${missingEntries[0]}`,
      missingEntries,
      newestSourceMtimeMs: null,
      oldestDistMtimeMs: null,
    };
  }

  const newestSourceMtimeMs = [
    collectLatestMtimeMs(join(normalizedPluginPath, "src")),
    statSync(packageJsonPath).mtimeMs,
    statSync(pluginManifestPath).mtimeMs,
  ].reduce((max, value) => (value !== null && value > max ? value : max), 0);
  const oldestDistMtimeMs = entryPaths.reduce((min, entryPath) => {
    const entryMtimeMs = statSync(entryPath).mtimeMs;
    return entryMtimeMs < min ? entryMtimeMs : min;
  }, Number.POSITIVE_INFINITY);

  if (newestSourceMtimeMs > oldestDistMtimeMs) {
    return {
      stale: true,
      reason: "production build is older than plugin source files",
      missingEntries: [],
      newestSourceMtimeMs,
      oldestDistMtimeMs,
    };
  }

  return {
    stale: false,
    reason: null,
    missingEntries: [],
    newestSourceMtimeMs,
    oldestDistMtimeMs,
  };
}

function normalizeMatchKey(value) {
  return value.trim().toLowerCase();
}

function collectFirstPartyPluginRecords(rootDir) {
  const extensionsDir = resolve(rootDir, "packages/extensions");
  if (!ensureDirectoryExists(extensionsDir)) {
    return [];
  }

  const records = [];
  for (const entry of readdirSync(extensionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const pluginPath = join(extensionsDir, entry.name);
    const { packageJsonPath, pluginManifestPath } = getManifestPaths(pluginPath);
    if (!existsSync(packageJsonPath) || !existsSync(pluginManifestPath)) {
      continue;
    }
    const { packageJson, pluginId } = readPluginPackage(pluginPath);
    const packageName = readOptionalString(packageJson?.name);
    records.push({
      pluginId,
      pluginPath,
      dirName: entry.name,
      packageName,
    });
  }
  return records;
}

function isExplicitPathRef(pluginRef) {
  return pluginRef.includes("/") || pluginRef.includes("\\") || pluginRef.startsWith(".");
}

export function resolveFirstPartyPluginRef(rootDir, pluginRef) {
  const normalizedRef = readOptionalString(pluginRef);
  if (!normalizedRef) {
    throw new Error("Plugin ref must not be empty.");
  }

  if (isExplicitPathRef(normalizedRef)) {
    const pluginPath = resolve(rootDir, normalizedRef);
    const { packageJson, pluginId } = readPluginPackage(pluginPath);
    return {
      pluginId,
      pluginPath,
      dirName: pluginPath.split(sep).at(-1) ?? pluginPath,
      packageName: readOptionalString(packageJson?.name),
    };
  }

  const candidates = collectFirstPartyPluginRecords(rootDir);
  const normalizedMatch = normalizeMatchKey(normalizedRef);
  const exactMatches = candidates.filter((entry) =>
    [entry.pluginId, entry.dirName, entry.packageName]
      .filter((value) => Boolean(value))
      .some((value) => normalizeMatchKey(value) === normalizedMatch),
  );
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }
  if (exactMatches.length > 1) {
    throw new Error(
      `Plugin ref "${pluginRef}" is ambiguous. Matches: ${exactMatches.map((entry) => entry.dirName).join(", ")}`,
    );
  }

  const suffixMatches = candidates.filter((entry) =>
    [entry.pluginId, entry.dirName, entry.packageName]
      .filter((value) => Boolean(value))
      .some((value) => normalizeMatchKey(value).endsWith(normalizedMatch)),
  );
  if (suffixMatches.length === 1) {
    return suffixMatches[0];
  }
  if (suffixMatches.length > 1) {
    throw new Error(
      `Plugin ref "${pluginRef}" is ambiguous. Matches: ${suffixMatches.map((entry) => entry.dirName).join(", ")}`,
    );
  }

  throw new Error(`Unknown first-party plugin ref "${pluginRef}".`);
}

export function validatePluginOverride(override) {
  const normalizedPluginPath = resolve(override.pluginPath);
  const { packageJson, pluginId } = readPluginPackage(normalizedPluginPath);
  if (pluginId !== override.pluginId) {
    throw new Error(
      `Plugin override id mismatch: expected "${override.pluginId}" but found "${pluginId}" at ${normalizedPluginPath}`,
    );
  }

  const extensions = readExtensionEntries(packageJson, override.source);
  if (extensions.length === 0) {
    const missingField =
      override.source === "development"
        ? "openclaw.development.extensions"
        : "openclaw.extensions";
    throw new Error(`Plugin override missing ${missingField}: ${join(normalizedPluginPath, "package.json")}`);
  }

  const missingEntry = extensions
    .map((entry) => resolve(normalizedPluginPath, entry))
    .find((entryPath) => !existsSync(entryPath));
  if (missingEntry) {
    throw new Error(`Plugin override entry not found: ${missingEntry}`);
  }

  if (override.source === "production") {
    const buildStatus = inspectProductionBuildStatus(normalizedPluginPath);
    if (buildStatus.stale) {
      throw new Error(
        `Plugin override production build is stale for "${override.pluginId}" at ${normalizedPluginPath}. ` +
          `Run \`pnpm -C ${normalizedPluginPath} build\` or use #development.`,
      );
    }
  }
}

export function pluginSupportsDevelopmentSource(pluginPath) {
  const { packageJson } = readPluginPackage(resolve(pluginPath));
  return readExtensionEntries(packageJson, "development").length > 0;
}

export function pluginHasBuildScript(pluginPath) {
  const { packageJson } = readPluginPackage(resolve(pluginPath));
  return Boolean(readOptionalString(packageJson?.scripts?.build));
}

export function createPluginOverrideValue({ pluginId, pluginPath, source }) {
  return `${pluginId}=${pluginPath}${source === "development" ? "#development" : ""}`;
}

export function readPluginOverrideMetadata(pluginPath) {
  const normalizedPluginPath = resolve(pluginPath);
  const { packageJson, pluginId } = readPluginPackage(normalizedPluginPath);
  return {
    pluginId,
    pluginPath: normalizedPluginPath,
    packageName: readOptionalString(packageJson?.name),
    supportsDevelopmentSource: readExtensionEntries(packageJson, "development").length > 0,
    hasBuildScript: Boolean(readOptionalString(packageJson?.scripts?.build)),
    sourceWatchPaths: collectSourceWatchPaths(normalizedPluginPath),
  };
}

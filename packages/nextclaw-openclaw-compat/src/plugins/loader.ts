import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { getWorkspacePathFromConfig, type Config } from "@nextclaw/core";
import { BUNDLED_CHANNEL_PLUGIN_PACKAGES } from "./bundled-channel-plugin-packages.constants.js";
import { filterPluginCandidatesByExcludedRoots } from "./candidate-filter.js";
import { normalizePluginsConfig, resolveEnableState } from "./config-state.js";
import { discoverOpenClawPlugins } from "./discovery.js";
import { loadPluginManifestRegistry } from "./manifest-registry.js";
import { loadBundledPluginModule, resolveBundledPluginEntry } from "./bundled-plugin-loader.js";
import { buildPluginLoaderAliases } from "./plugin-loader-aliases.js";
import { createPluginJiti } from "./plugin-loader-jiti.js";
import { createPluginRecord, validatePluginConfig } from "./plugin-loader-utils.js";
import { createPluginRegisterRuntime, registerPluginWithApi, type PluginRegisterRuntime } from "./registry.js";
import type { OpenClawPluginDefinition, OpenClawPluginModule, PluginKind, PluginLogger, PluginRecord, PluginRegistry } from "./types.js";

export type PluginLoadOptions = {
  config: Config;
  workspaceDir?: string;
  logger?: PluginLogger;
  mode?: "full" | "validate";
  includeBundled?: boolean;
  kinds?: PluginKind[];
  excludeRoots?: string[];
  reservedToolNames?: string[];
  reservedChannelIds?: string[];
  reservedProviderIds?: string[];
  reservedEngineKinds?: string[];
  reservedNcpAgentRuntimeKinds?: string[];
};

const defaultLogger: PluginLogger = {
  info: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
  error: (message: string) => console.error(message),
  debug: (message: string) => console.debug(message)
};

const STARTUP_TRACE_ENABLED = process.env.NEXTCLAW_STARTUP_TRACE === "1";

function logPluginStartupTrace(step: string, fields?: Record<string, string | number | boolean | undefined>): void {
  if (!STARTUP_TRACE_ENABLED) {
    return;
  }
  const suffix = Object.entries(fields ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  console.log(`[startup-trace] ${step}${suffix ? ` ${suffix}` : ""}`);
}

function resolvePackageRootFromEntry(entryFile: string): string {
  let cursor = path.dirname(entryFile);
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
  return path.dirname(entryFile);
}
export { buildPluginLoaderAliases } from "./plugin-loader-aliases.js";
export { loadOpenClawPluginsProgressively } from "./progressive-plugin-loader/progressive-plugin-loader.js";
export type { ProgressivePluginLoadOptions } from "./progressive-plugin-loader/progressive-plugin-loader.js";
function resolvePluginModuleExport(moduleExport: unknown): {
  definition?: OpenClawPluginDefinition;
  register?: OpenClawPluginDefinition["register"];
} {
  const resolved =
    moduleExport && typeof moduleExport === "object" && "default" in (moduleExport as Record<string, unknown>)
      ? (moduleExport as { default: unknown }).default
      : moduleExport;

  if (typeof resolved === "function") {
    return {
      register: resolved as OpenClawPluginDefinition["register"]
    };
  }

  if (resolved && typeof resolved === "object") {
    const definition = resolved as OpenClawPluginDefinition;
    return {
      definition,
      register: definition.register ?? definition.activate
    };
  }

  return {};
}

function appendBundledChannelPlugins(params: {
  runtime: PluginRegisterRuntime;
  registry: PluginRegistry;
  normalizedConfig: ReturnType<typeof normalizePluginsConfig>;
}): void {
  const require = createRequire(import.meta.url);

  for (const packageName of BUNDLED_CHANNEL_PLUGIN_PACKAGES) {
    const packageStartedAt = Date.now();
    const resolvedEntry = resolveBundledPluginEntry(
      require,
      packageName,
      params.registry.diagnostics,
      resolvePackageRootFromEntry
    );
    if (!resolvedEntry) {
      continue;
    }
    const { entryFile, rootDir } = resolvedEntry;

    let moduleExport: OpenClawPluginModule | null = null;
    try {
      moduleExport = loadBundledPluginModule(entryFile, rootDir);
    } catch (err) {
      params.registry.diagnostics.push({
        level: "error",
        source: entryFile,
        message: `failed to load bundled plugin: ${String(err)}`
      });
      continue;
    }

    const resolved = resolvePluginModuleExport(moduleExport);
    const definition = resolved.definition;
    const register = resolved.register;

    const pluginId = typeof definition?.id === "string" ? definition.id.trim() : "";
    const source = entryFile;
    if (!pluginId) {
      params.registry.diagnostics.push({
        level: "error",
        source,
        message: "bundled plugin definition missing id"
      });
      continue;
    }

    const enableState = resolveEnableState(pluginId, params.normalizedConfig);

    const record = createPluginRecord({
      id: pluginId,
      name: definition?.name ?? pluginId,
      description: definition?.description,
      version: definition?.version,
      kind: definition?.kind,
      source,
      origin: "bundled",
      workspaceDir: params.runtime.workspaceDir,
      enabled: enableState.enabled,
      configSchema: Boolean(definition?.configSchema),
      configJsonSchema: definition?.configSchema
    });

    if (!enableState.enabled) {
      record.status = "disabled";
      record.error = enableState.reason;
      params.registry.plugins.push(record);
      continue;
    }

    if (typeof register !== "function") {
      record.status = "error";
      record.error = "plugin export missing register/activate";
      params.registry.plugins.push(record);
      params.registry.diagnostics.push({
        level: "error",
        pluginId,
        source,
        message: record.error
      });
      continue;
    }

    const result = registerPluginWithApi({
      runtime: params.runtime,
      record,
      pluginId,
      source,
      rootDir,
      register,
      pluginConfig: undefined
    });

    if (!result.ok) {
      record.status = "error";
      record.error = result.error;
      params.registry.diagnostics.push({
        level: "error",
        pluginId,
        source,
        message: result.error
      });
    }

    params.registry.plugins.push(record);
    logPluginStartupTrace("plugin.loader.bundled_plugin", {
      package: packageName,
      plugin_id: pluginId,
      duration_ms: Date.now() - packageStartedAt
    });
  }
}

function loadExternalPluginModule(candidateSource: string, pluginRoot: string): OpenClawPluginModule {
  const pluginJiti = createPluginJiti(buildPluginLoaderAliases(pluginRoot));
  return pluginJiti(candidateSource) as OpenClawPluginModule;
}

export function loadOpenClawPlugins(options: PluginLoadOptions): PluginRegistry {
  const startedAt = Date.now();
  const loadExternalPlugins = process.env.NEXTCLAW_ENABLE_OPENCLAW_PLUGINS !== "0";
  const pluginKinds = options.kinds?.length ? new Set(options.kinds.map((entry) => entry.trim()).filter(Boolean)) : null;
  const logger = options.logger ?? defaultLogger;
  const workspaceDir = options.workspaceDir?.trim() || getWorkspacePathFromConfig(options.config);
  const normalized = normalizePluginsConfig(options.config.plugins);
  const registry: PluginRegistry = {
    plugins: [],
    tools: [],
    channels: [],
    providers: [],
    engines: [],
    ncpAgentRuntimes: [],
    diagnostics: [],
    resolvedTools: []
  };

  const reservedToolNames = new Set(options.reservedToolNames ?? []);
  const reservedChannelIds = new Set(options.reservedChannelIds ?? []);
  const reservedProviderIds = new Set(options.reservedProviderIds ?? []);
  const reservedEngineKinds = new Set((options.reservedEngineKinds ?? ["native"]).map((entry) => entry.toLowerCase()));
  const reservedNcpAgentRuntimeKinds = new Set(
    (options.reservedNcpAgentRuntimeKinds ?? ["native"]).map((entry) => entry.toLowerCase())
  );

  const registerRuntime = createPluginRegisterRuntime({
    config: options.config,
    workspaceDir,
    logger,
    registry,
    reservedToolNames,
    reservedChannelIds,
    reservedProviderIds,
    reservedEngineKinds,
    reservedNcpAgentRuntimeKinds
  });

  if (options.includeBundled !== false) appendBundledChannelPlugins({ registry, runtime: registerRuntime, normalizedConfig: normalized });
  if (!loadExternalPlugins) {
    return registry;
  }

  const discovery = discoverOpenClawPlugins({
    config: options.config,
    workspaceDir,
    extraPaths: normalized.loadPaths
  });
  const filteredCandidates = filterPluginCandidatesByExcludedRoots(discovery.candidates, options.excludeRoots ?? []);
  const manifestRegistry = loadPluginManifestRegistry({
    config: options.config,
    workspaceDir,
    candidates: filteredCandidates,
    diagnostics: discovery.diagnostics
  });

  registry.diagnostics.push(...manifestRegistry.diagnostics);
  const manifestByRoot = new Map(
    (pluginKinds ? manifestRegistry.plugins.filter((entry) => entry.kind && pluginKinds.has(entry.kind)) : manifestRegistry.plugins)
      .map((entry) => [entry.rootDir, entry])
  );
  const seenIds = new Map<string, PluginRecord["origin"]>(
    registry.plugins.map((entry) => [entry.id, entry.origin])
  );

  for (const candidate of filteredCandidates) {
    const candidateStartedAt = Date.now();
    const manifest = manifestByRoot.get(candidate.rootDir);
    if (!manifest) {
      continue;
    }

    const pluginId = manifest.id;
    const existingOrigin = seenIds.get(pluginId);
    if (existingOrigin) {
      const record = createPluginRecord({
        id: pluginId,
        name: manifest.name ?? pluginId,
        description: manifest.description,
        version: manifest.version,
        kind: manifest.kind,
        source: candidate.source,
        origin: candidate.origin,
        workspaceDir: candidate.workspaceDir,
        enabled: false,
        configSchema: Boolean(manifest.configSchema),
        configUiHints: manifest.configUiHints,
        configJsonSchema: manifest.configSchema
      });
      record.status = "disabled";
      record.error = `overridden by ${existingOrigin} plugin`;
      registry.plugins.push(record);
      continue;
    }

    const enableState = resolveEnableState(pluginId, normalized);
    const entry = normalized.entries[pluginId];

    const record = createPluginRecord({
      id: pluginId,
      name: manifest.name ?? pluginId,
      description: manifest.description,
      version: manifest.version,
      kind: manifest.kind,
      source: candidate.source,
      origin: candidate.origin,
      workspaceDir: candidate.workspaceDir,
      enabled: enableState.enabled,
      configSchema: Boolean(manifest.configSchema),
      configUiHints: manifest.configUiHints,
      configJsonSchema: manifest.configSchema
    });

    if (!enableState.enabled) {
      record.status = "disabled";
      record.error = enableState.reason;
      registry.plugins.push(record);
      seenIds.set(pluginId, candidate.origin);
      continue;
    }

    if (!manifest.configSchema) {
      record.status = "error";
      record.error = "missing config schema";
      registry.plugins.push(record);
      seenIds.set(pluginId, candidate.origin);
      registry.diagnostics.push({
        level: "error",
        pluginId,
        source: candidate.source,
        message: record.error
      });
      continue;
    }

    const validatedConfig = validatePluginConfig({
      schema: manifest.configSchema,
      cacheKey: manifest.schemaCacheKey,
      value: entry?.config
    });

    if (!validatedConfig.ok) {
      record.status = "error";
      record.error = `invalid config: ${validatedConfig.errors.join(", ")}`;
      registry.plugins.push(record);
      seenIds.set(pluginId, candidate.origin);
      registry.diagnostics.push({
        level: "error",
        pluginId,
        source: candidate.source,
        message: record.error
      });
      continue;
    }

    if ((options.mode ?? "full") === "validate") {
      registry.plugins.push(record);
      seenIds.set(pluginId, candidate.origin);
      continue;
    }

    let moduleExport: OpenClawPluginModule | null = null;
    try {
      const moduleLoadStartedAt = Date.now();
      moduleExport = loadExternalPluginModule(candidate.source, candidate.rootDir);
      logPluginStartupTrace("plugin.loader.external_module_loaded", {
        plugin_id: pluginId,
        duration_ms: Date.now() - moduleLoadStartedAt,
        source: candidate.source
      });
    } catch (err) {
      record.status = "error";
      record.error = `failed to load plugin: ${String(err)}`;
      registry.plugins.push(record);
      seenIds.set(pluginId, candidate.origin);
      registry.diagnostics.push({
        level: "error",
        pluginId,
        source: candidate.source,
        message: record.error
      });
      continue;
    }

    const resolved = resolvePluginModuleExport(moduleExport);
    const definition = resolved.definition;
    const register = resolved.register;

    if (definition?.id && definition.id !== pluginId) {
      registry.diagnostics.push({
        level: "warn",
        pluginId,
        source: candidate.source,
        message: `plugin id mismatch (manifest uses "${pluginId}", export uses "${definition.id}")`
      });
    }

    record.name = definition?.name ?? record.name;
    record.description = definition?.description ?? record.description;
    record.version = definition?.version ?? record.version;
    record.kind = definition?.kind ?? record.kind;

    if (typeof register !== "function") {
      record.status = "error";
      record.error = "plugin export missing register/activate";
      registry.plugins.push(record);
      seenIds.set(pluginId, candidate.origin);
      registry.diagnostics.push({
        level: "error",
        pluginId,
        source: candidate.source,
        message: record.error
      });
      continue;
    }

    const registerResult = registerPluginWithApi({
      runtime: registerRuntime,
      record,
      pluginId,
      source: candidate.source,
      rootDir: candidate.rootDir,
      register,
      pluginConfig: validatedConfig.value
    });
    logPluginStartupTrace("plugin.loader.external_plugin_registered", {
      plugin_id: pluginId,
      duration_ms: Date.now() - candidateStartedAt,
      source: candidate.source
    });

    if (!registerResult.ok) {
      record.status = "error";
      record.error = registerResult.error;
      registry.diagnostics.push({
        level: "error",
        pluginId,
        source: candidate.source,
        message: registerResult.error
      });
      registry.plugins.push(record);
      seenIds.set(pluginId, candidate.origin);
      continue;
    }

    registry.plugins.push(record);
    seenIds.set(pluginId, candidate.origin);
  }

  logPluginStartupTrace("plugin.loader.total", {
    duration_ms: Date.now() - startedAt,
    plugin_count: registry.plugins.length
  });

  return registry;
}

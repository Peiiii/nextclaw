import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import createJitiImport from "jiti";
import type { Config } from "@nextclaw/core";
import { getWorkspacePathFromConfig } from "@nextclaw/core";
import { normalizePluginsConfig, resolveEnableState } from "./config-state.js";
import { discoverOpenClawPlugins } from "./discovery.js";
import { loadPluginManifestRegistry } from "./manifest-registry.js";
import { validateJsonSchemaValue } from "./schema-validator.js";
import { createPluginRegisterRuntime, registerPluginWithApi, type PluginRegisterRuntime } from "./registry.js";
import type {
  OpenClawPluginDefinition,
  OpenClawPluginModule,
  PluginLogger,
  PluginRecord,
  PluginRegistry
} from "./types.js";

export type PluginLoadOptions = {
  config: Config;
  workspaceDir?: string;
  logger?: PluginLogger;
  mode?: "full" | "validate";
  reservedToolNames?: string[];
  reservedChannelIds?: string[];
  reservedProviderIds?: string[];
};

type JitiFactory = (
  filename: string,
  options?: Record<string, unknown>
) => (id: string) => unknown;

const createJiti = createJitiImport as unknown as JitiFactory;

const defaultLogger: PluginLogger = {
  info: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
  error: (message: string) => console.error(message),
  debug: (message: string) => console.debug(message)
};

const BUNDLED_CHANNEL_PLUGIN_PACKAGES = [
  "@nextclaw/channel-plugin-telegram",
  "@nextclaw/channel-plugin-whatsapp",
  "@nextclaw/channel-plugin-discord",
  "@nextclaw/channel-plugin-feishu",
  "@nextclaw/channel-plugin-mochat",
  "@nextclaw/channel-plugin-dingtalk",
  "@nextclaw/channel-plugin-email",
  "@nextclaw/channel-plugin-slack",
  "@nextclaw/channel-plugin-qq"
] as const;



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

function createPluginRecord(params: {
  id: string;
  name?: string;
  description?: string;
  version?: string;
  source: string;
  origin: PluginRecord["origin"];
  workspaceDir?: string;
  enabled: boolean;
  configSchema: boolean;
  configUiHints?: PluginRecord["configUiHints"];
  configJsonSchema?: PluginRecord["configJsonSchema"];
  kind?: PluginRecord["kind"];
}): PluginRecord {
  return {
    id: params.id,
    name: params.name ?? params.id,
    description: params.description,
    version: params.version,
    kind: params.kind,
    source: params.source,
    origin: params.origin,
    workspaceDir: params.workspaceDir,
    enabled: params.enabled,
    status: params.enabled ? "loaded" : "disabled",
    toolNames: [],
    channelIds: [],
    providerIds: [],
    configSchema: params.configSchema,
    configUiHints: params.configUiHints,
    configJsonSchema: params.configJsonSchema
  };
}

function isPlaceholderConfigSchema(schema: Record<string, unknown> | undefined): boolean {
  if (!schema || typeof schema !== "object") {
    return false;
  }
  const type = schema.type;
  const isObjectType = type === "object" || (Array.isArray(type) && type.includes("object"));
  if (!isObjectType) {
    return false;
  }
  const properties = schema.properties;
  const noProperties =
    !properties ||
    (typeof properties === "object" && !Array.isArray(properties) && Object.keys(properties as Record<string, unknown>).length === 0);
  return noProperties && schema.additionalProperties === false;
}

function validatePluginConfig(params: {
  schema?: Record<string, unknown>;
  cacheKey?: string;
  value?: unknown;
}): { ok: true; value?: Record<string, unknown> } | { ok: false; errors: string[] } {
  if (!params.schema || isPlaceholderConfigSchema(params.schema)) {
    return { ok: true, value: params.value as Record<string, unknown> | undefined };
  }

  const cacheKey = params.cacheKey ?? JSON.stringify(params.schema);
  const result = validateJsonSchemaValue({
    schema: params.schema,
    cacheKey,
    value: params.value ?? {}
  });

  if (result.ok) {
    return { ok: true, value: params.value as Record<string, unknown> | undefined };
  }

  return { ok: false, errors: result.errors };
}

function appendBundledChannelPlugins(params: {
  runtime: PluginRegisterRuntime;
  registry: PluginRegistry;
  jiti: ReturnType<JitiFactory>;
}): void {
  const require = createRequire(import.meta.url);

  for (const packageName of BUNDLED_CHANNEL_PLUGIN_PACKAGES) {
    let entryFile = "";
    let rootDir = "";

    try {
      entryFile = require.resolve(packageName);
      rootDir = resolvePackageRootFromEntry(entryFile);
    } catch (err) {
      params.registry.diagnostics.push({
        level: "error",
        source: packageName,
        message: `bundled plugin package not resolvable: ${String(err)}`
      });
      continue;
    }

    let moduleExport: OpenClawPluginModule | null = null;
    try {
      moduleExport = params.jiti(entryFile) as OpenClawPluginModule;
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

    const record = createPluginRecord({
      id: pluginId,
      name: definition?.name ?? pluginId,
      description: definition?.description,
      version: definition?.version,
      kind: definition?.kind,
      source,
      origin: "bundled",
      workspaceDir: params.runtime.workspaceDir,
      enabled: true,
      configSchema: Boolean(definition?.configSchema),
      configJsonSchema: definition?.configSchema
    });

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
  }
}

export function loadOpenClawPlugins(options: PluginLoadOptions): PluginRegistry {
  const loadExternalPlugins = process.env.NEXTCLAW_ENABLE_OPENCLAW_PLUGINS !== "0";

  const logger = options.logger ?? defaultLogger;

  const workspaceDir = options.workspaceDir?.trim() || getWorkspacePathFromConfig(options.config);
  const normalized = normalizePluginsConfig(options.config.plugins);
  const mode = options.mode ?? "full";

  const registry: PluginRegistry = {
    plugins: [],
    tools: [],
    channels: [],
    providers: [],
    diagnostics: [],
    resolvedTools: []
  };

  const reservedToolNames = new Set(options.reservedToolNames ?? []);
  const reservedChannelIds = new Set(options.reservedChannelIds ?? []);
  const reservedProviderIds = new Set(options.reservedProviderIds ?? []);

  const registerRuntime = createPluginRegisterRuntime({
    config: options.config,
    workspaceDir,
    logger,
    registry,
    reservedToolNames,
    reservedChannelIds,
    reservedProviderIds
  });

  const pluginSdkAlias = resolvePluginSdkAlias();
  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"],
    ...(pluginSdkAlias
      ? {
          alias: {
            "openclaw/plugin-sdk": pluginSdkAlias
          }
        }
      : {})
  });

  appendBundledChannelPlugins({
    registry,
    runtime: registerRuntime,
    jiti
  });

  if (!loadExternalPlugins) {
    return registry;
  }

  const discovery = discoverOpenClawPlugins({
    config: options.config,
    workspaceDir,
    extraPaths: normalized.loadPaths
  });
  const manifestRegistry = loadPluginManifestRegistry({
    config: options.config,
    workspaceDir,
    candidates: discovery.candidates,
    diagnostics: discovery.diagnostics
  });

  registry.diagnostics.push(...manifestRegistry.diagnostics);

  const manifestByRoot = new Map(manifestRegistry.plugins.map((entry) => [entry.rootDir, entry]));
  const seenIds = new Map<string, PluginRecord["origin"]>(
    registry.plugins.map((entry) => [entry.id, entry.origin])
  );

  for (const candidate of discovery.candidates) {
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

    if (mode === "validate") {
      registry.plugins.push(record);
      seenIds.set(pluginId, candidate.origin);
      continue;
    }

    let moduleExport: OpenClawPluginModule | null = null;
    try {
      moduleExport = jiti(candidate.source) as OpenClawPluginModule;
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

  return registry;
}

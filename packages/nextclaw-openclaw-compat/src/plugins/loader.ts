import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJitiImport from "jiti";
import type { Config } from "@nextclaw/core";
import { getWorkspacePathFromConfig } from "@nextclaw/core";
import { expandHome } from "@nextclaw/core";
import { normalizePluginsConfig, resolveEnableState } from "./config-state.js";
import { discoverOpenClawPlugins } from "./discovery.js";
import { loadPluginManifestRegistry } from "./manifest-registry.js";
import { createPluginRuntime } from "./runtime.js";
import { validateJsonSchemaValue } from "./schema-validator.js";
import type {
  OpenClawPluginApi,
  OpenClawPluginChannelRegistration,
  OpenClawPluginDefinition,
  OpenClawPluginModule,
  OpenClawPluginTool,
  OpenClawPluginToolContext,
  OpenClawPluginToolFactory,
  PluginDiagnostic,
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

function normalizeToolList(value: unknown): OpenClawPluginTool[] {
  if (!value) {
    return [];
  }
  const list = Array.isArray(value) ? value : [value];
  return list.filter((entry): entry is OpenClawPluginTool => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const candidate = entry as OpenClawPluginTool;
    return (
      typeof candidate.name === "string" &&
      candidate.name.trim().length > 0 &&
      candidate.parameters !== undefined &&
      typeof candidate.execute === "function"
    );
  });
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

function buildPluginLogger(base: PluginLogger, pluginId: string): PluginLogger {
  const withPrefix = (message: string) => `[plugins:${pluginId}] ${message}`;
  return {
    info: (message: string) => base.info(withPrefix(message)),
    warn: (message: string) => base.warn(withPrefix(message)),
    error: (message: string) => base.error(withPrefix(message)),
    debug: base.debug ? (message: string) => base.debug?.(withPrefix(message)) : undefined
  };
}

function ensureUniqueNames(params: {
  names: string[];
  pluginId: string;
  diagnostics: PluginDiagnostic[];
  source: string;
  owners: Map<string, string>;
  reserved: Set<string>;
  kind: "tool" | "channel" | "provider";
}): string[] {
  const accepted: string[] = [];
  for (const rawName of params.names) {
    const name = rawName.trim();
    if (!name) {
      continue;
    }
    if (params.reserved.has(name)) {
      params.diagnostics.push({
        level: "error",
        pluginId: params.pluginId,
        source: params.source,
        message: `${params.kind} already registered by core: ${name}`
      });
      continue;
    }
    const owner = params.owners.get(name);
    if (owner && owner !== params.pluginId) {
      params.diagnostics.push({
        level: "error",
        pluginId: params.pluginId,
        source: params.source,
        message: `${params.kind} already registered: ${name} (${owner})`
      });
      continue;
    }
    params.owners.set(name, params.pluginId);
    accepted.push(name);
  }
  return accepted;
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

export function loadOpenClawPlugins(options: PluginLoadOptions): PluginRegistry {
  if (process.env.NEXTCLAW_ENABLE_OPENCLAW_PLUGINS === "0") {
    return {
      plugins: [],
      tools: [],
      channels: [],
      providers: [],
      diagnostics: [],
      resolvedTools: []
    };
  }

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

  const toolNameOwners = new Map<string, string>();
  const channelIdOwners = new Map<string, string>();
  const providerIdOwners = new Map<string, string>();
  const resolvedToolNames = new Set<string>();

  const reservedToolNames = new Set(options.reservedToolNames ?? []);
  const reservedChannelIds = new Set(options.reservedChannelIds ?? []);
  const reservedProviderIds = new Set(options.reservedProviderIds ?? []);

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
  const seenIds = new Map<string, PluginRecord["origin"]>();

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

    const pluginRuntime = createPluginRuntime({ workspace: workspaceDir, config: options.config });

    const pluginLogger = buildPluginLogger(logger, pluginId);

    const pushUnsupported = (capability: string) => {
      registry.diagnostics.push({
        level: "warn",
        pluginId,
        source: candidate.source,
        message: `${capability} is not supported by nextclaw compat layer yet`
      });
      pluginLogger.warn(`${capability} is ignored (not supported yet)`);
    };

    const api: OpenClawPluginApi = {
      id: pluginId,
      name: record.name,
      version: record.version,
      description: record.description,
      source: candidate.source,
      config: options.config,
      pluginConfig: validatedConfig.value,
      runtime: pluginRuntime,
      logger: pluginLogger,
      registerTool: (tool, opts) => {
        const declaredNames = opts && Array.isArray(opts.names) ? opts.names : [];
        const names = [...declaredNames, ...(opts && opts.name ? [opts.name] : [])];
        if (typeof tool !== "function" && typeof tool.name === "string") {
          names.push(tool.name);
        }
        const uniqueNames = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
        const acceptedNames = ensureUniqueNames({
          names: uniqueNames,
          pluginId,
          diagnostics: registry.diagnostics,
          source: candidate.source,
          owners: toolNameOwners,
          reserved: reservedToolNames,
          kind: "tool"
        });
        if (acceptedNames.length === 0) {
          registry.diagnostics.push({
            level: "warn",
            pluginId,
            source: candidate.source,
            message: "tool registration skipped: no available tool names"
          });
          return;
        }

        const factory: OpenClawPluginToolFactory =
          typeof tool === "function" ? tool : (_ctx: OpenClawPluginToolContext) => tool;

        registry.tools.push({
          pluginId,
          factory,
          names: acceptedNames,
          optional: opts?.optional === true,
          source: candidate.source
        });
        record.toolNames.push(...acceptedNames);

        try {
          const previewTools = normalizeToolList(
            factory({
              config: options.config,
              workspaceDir,
              sandboxed: false
            })
          );
          const byName = new Map(previewTools.map((entry) => [entry.name, entry]));
          for (const name of acceptedNames) {
            const resolvedTool = byName.get(name);
            if (!resolvedTool || resolvedToolNames.has(resolvedTool.name)) {
              continue;
            }
            resolvedToolNames.add(resolvedTool.name);
            registry.resolvedTools.push(resolvedTool);
          }
        } catch (err) {
          registry.diagnostics.push({
            level: "warn",
            pluginId,
            source: candidate.source,
            message: `tool preview failed: ${String(err)}`
          });
        }
      },
      registerChannel: (registration: OpenClawPluginChannelRegistration) => {
        const normalizedChannel =
          registration &&
          typeof registration === "object" &&
          "plugin" in (registration as Record<string, unknown>)
            ? (registration as { plugin: unknown }).plugin
            : registration;

        if (!normalizedChannel || typeof normalizedChannel !== "object") {
          registry.diagnostics.push({
            level: "error",
            pluginId,
            source: candidate.source,
            message: "channel registration missing plugin object"
          });
          return;
        }

        const channelObj = normalizedChannel as { id?: unknown };
        const rawId = typeof channelObj.id === "string" ? channelObj.id : String(channelObj.id ?? "");
        const accepted = ensureUniqueNames({
          names: [rawId],
          pluginId,
          diagnostics: registry.diagnostics,
          source: candidate.source,
          owners: channelIdOwners,
          reserved: reservedChannelIds,
          kind: "channel"
        });

        if (accepted.length === 0) {
          return;
        }

        const channelPlugin = normalizedChannel as PluginRegistry["channels"][number]["channel"];
        registry.channels.push({
          pluginId,
          channel: channelPlugin,
          source: candidate.source
        });
        const channelId = accepted[0];
        record.channelIds.push(channelId);

        const configSchema = (channelPlugin as { configSchema?: { schema?: unknown; uiHints?: unknown } }).configSchema;
        if (configSchema && typeof configSchema === "object") {
          const schema = configSchema.schema;
          if (schema && typeof schema === "object" && !Array.isArray(schema)) {
            record.configJsonSchema = schema as Record<string, unknown>;
            record.configSchema = true;
          }
          const uiHints = configSchema.uiHints;
          if (uiHints && typeof uiHints === "object" && !Array.isArray(uiHints)) {
            record.configUiHints = {
              ...(record.configUiHints ?? {}),
              ...(uiHints as NonNullable<PluginRecord["configUiHints"]>)
            };
          }
        }

        const pushChannelTools = (
          value: unknown,
          optional: boolean,
          sourceLabel: string,
          resolveValue: (ctx: OpenClawPluginToolContext) => unknown
        ) => {
          const previewTools = normalizeToolList(value);
          if (previewTools.length === 0) {
            return;
          }

          const declaredNames = previewTools.map((tool) => tool.name);
          const acceptedNames = ensureUniqueNames({
            names: declaredNames,
            pluginId,
            diagnostics: registry.diagnostics,
            source: candidate.source,
            owners: toolNameOwners,
            reserved: reservedToolNames,
            kind: "tool"
          });
          if (acceptedNames.length === 0) {
            return;
          }

          const factory: OpenClawPluginToolFactory = (ctx: OpenClawPluginToolContext) => {
            const tools = normalizeToolList(resolveValue(ctx));
            if (tools.length === 0) {
              return [];
            }
            const byName = new Map(tools.map((tool) => [tool.name, tool]));
            return acceptedNames.map((name) => byName.get(name)).filter(Boolean) as OpenClawPluginTool[];
          };

          registry.tools.push({
            pluginId,
            factory,
            names: acceptedNames,
            optional,
            source: candidate.source
          });
          record.toolNames.push(...acceptedNames);

          const previewByName = new Map(previewTools.map((tool) => [tool.name, tool]));
          for (const name of acceptedNames) {
            const resolvedTool = previewByName.get(name);
            if (!resolvedTool || resolvedToolNames.has(resolvedTool.name)) {
              continue;
            }
            resolvedToolNames.add(resolvedTool.name);
            registry.resolvedTools.push(resolvedTool);
          }

          registry.diagnostics.push({
            level: "warn",
            pluginId,
            source: candidate.source,
            message: `${sourceLabel} registered channel-owned tools: ${acceptedNames.join(", ")}`
          });
        };

        const agentTools = (channelPlugin as { agentTools?: unknown }).agentTools;
        if (typeof agentTools === "function") {
          pushChannelTools(
            normalizeToolList((agentTools as () => unknown)()),
            false,
            `channel "${channelId}"`,
            () => (agentTools as () => unknown)()
          );
        } else if (agentTools) {
          pushChannelTools(
            normalizeToolList(agentTools),
            false,
            `channel "${channelId}"`,
            () => agentTools
          );
        }

      },
      registerProvider: (provider) => {
        const accepted = ensureUniqueNames({
          names: [provider.id],
          pluginId,
          diagnostics: registry.diagnostics,
          source: candidate.source,
          owners: providerIdOwners,
          reserved: reservedProviderIds,
          kind: "provider"
        });
        if (accepted.length === 0) {
          return;
        }
        registry.providers.push({
          pluginId,
          provider,
          source: candidate.source
        });
        record.providerIds.push(accepted[0]);
      },
      registerHook: () => pushUnsupported("registerHook"),
      registerGatewayMethod: () => pushUnsupported("registerGatewayMethod"),
      registerCli: () => pushUnsupported("registerCli"),
      registerService: () => pushUnsupported("registerService"),
      registerCommand: () => pushUnsupported("registerCommand"),
      registerHttpHandler: () => pushUnsupported("registerHttpHandler"),
      registerHttpRoute: () => pushUnsupported("registerHttpRoute"),
      resolvePath: (input: string) => {
        const trimmed = input.trim();
        if (!trimmed) {
          return candidate.rootDir;
        }
        if (path.isAbsolute(trimmed)) {
          return path.resolve(expandHome(trimmed));
        }
        return path.resolve(candidate.rootDir, trimmed);
      }
    };

    try {
      const result = register(api);
      if (result && typeof result === "object" && "then" in result) {
        registry.diagnostics.push({
          level: "warn",
          pluginId,
          source: candidate.source,
          message: "plugin register returned a promise; async registration is ignored"
        });
      }
      registry.plugins.push(record);
      seenIds.set(pluginId, candidate.origin);
    } catch (err) {
      record.status = "error";
      record.error = `plugin failed during register: ${String(err)}`;
      registry.plugins.push(record);
      seenIds.set(pluginId, candidate.origin);
      registry.diagnostics.push({
        level: "error",
        pluginId,
        source: candidate.source,
        message: record.error
      });
    }
  }

  return registry;
}

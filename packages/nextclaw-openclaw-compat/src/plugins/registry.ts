import path from "node:path";
import { expandHome, type Config } from "@nextclaw/core";
import { createPluginRuntime } from "./runtime.js";
import type {
  OpenClawPluginApi,
  OpenClawPluginChannelRegistration,
  OpenClawPluginTool,
  OpenClawPluginToolContext,
  OpenClawPluginToolFactory,
  PluginDiagnostic,
  PluginLogger,
  PluginRecord,
  PluginRegistry,
  PluginToolRegistration
} from "./types.js";

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

export type PluginRegisterRuntime = {
  config: Config;
  workspaceDir: string;
  logger: PluginLogger;
  registry: PluginRegistry;
  toolNameOwners: Map<string, string>;
  channelIdOwners: Map<string, string>;
  providerIdOwners: Map<string, string>;
  resolvedToolNames: Set<string>;
  reservedToolNames: Set<string>;
  reservedChannelIds: Set<string>;
  reservedProviderIds: Set<string>;
};

export function createPluginRegisterRuntime(params: {
  config: Config;
  workspaceDir: string;
  logger: PluginLogger;
  registry: PluginRegistry;
  reservedToolNames: Set<string>;
  reservedChannelIds: Set<string>;
  reservedProviderIds: Set<string>;
}): PluginRegisterRuntime {
  return {
    config: params.config,
    workspaceDir: params.workspaceDir,
    logger: params.logger,
    registry: params.registry,
    toolNameOwners: new Map<string, string>(),
    channelIdOwners: new Map<string, string>(),
    providerIdOwners: new Map<string, string>(),
    resolvedToolNames: new Set<string>(),
    reservedToolNames: params.reservedToolNames,
    reservedChannelIds: params.reservedChannelIds,
    reservedProviderIds: params.reservedProviderIds
  };
}

function registerPluginTool(params: {
  runtime: PluginRegisterRuntime;
  record: PluginRecord;
  pluginId: string;
  source: string;
  tool: OpenClawPluginTool | OpenClawPluginToolFactory;
  opts?: { name?: string; names?: string[]; optional?: boolean };
}): void {
  const toolInput = params.tool;
  const normalizedNames: string[] = [];

  if (Array.isArray(params.opts?.names)) {
    for (const name of params.opts?.names ?? []) {
      const trimmed = String(name).trim();
      if (trimmed) {
        normalizedNames.push(trimmed);
      }
    }
  } else if (params.opts?.name && String(params.opts.name).trim()) {
    normalizedNames.push(String(params.opts.name).trim());
  }

  if (typeof toolInput !== "function") {
    const intrinsic = toolInput.name.trim();
    if (intrinsic) {
      normalizedNames.push(intrinsic);
    }
  }

  const acceptedNames = ensureUniqueNames({
    names: normalizedNames,
    pluginId: params.pluginId,
    diagnostics: params.runtime.registry.diagnostics,
    source: params.source,
    owners: params.runtime.toolNameOwners,
    reserved: params.runtime.reservedToolNames,
    kind: "tool"
  });

  if (acceptedNames.length === 0) {
    return;
  }

  const factory: OpenClawPluginToolFactory =
    typeof toolInput === "function"
      ? (toolInput as OpenClawPluginToolFactory)
      : () => toolInput as OpenClawPluginTool;

  const registration: PluginToolRegistration = {
    pluginId: params.pluginId,
    factory,
    names: acceptedNames,
    optional: params.opts?.optional === true,
    source: params.source
  };
  params.runtime.registry.tools.push(registration);
  params.record.toolNames.push(...acceptedNames);

  if (typeof toolInput === "function") {
    return;
  }

  if (!params.runtime.resolvedToolNames.has(toolInput.name)) {
    params.runtime.resolvedToolNames.add(toolInput.name);
    params.runtime.registry.resolvedTools.push(toolInput);
  }
}

function registerPluginChannel(params: {
  runtime: PluginRegisterRuntime;
  record: PluginRecord;
  pluginId: string;
  source: string;
  registration: OpenClawPluginChannelRegistration;
}): void {
  const normalizedChannel =
    params.registration &&
    typeof params.registration === "object" &&
    "plugin" in (params.registration as Record<string, unknown>)
      ? (params.registration as { plugin: unknown }).plugin
      : params.registration;

  if (!normalizedChannel || typeof normalizedChannel !== "object") {
    params.runtime.registry.diagnostics.push({
      level: "error",
      pluginId: params.pluginId,
      source: params.source,
      message: "channel registration missing plugin object"
    });
    return;
  }

  const channelObj = normalizedChannel as { id?: unknown };
  const rawId = typeof channelObj.id === "string" ? channelObj.id : String(channelObj.id ?? "");
  const accepted = ensureUniqueNames({
    names: [rawId],
    pluginId: params.pluginId,
    diagnostics: params.runtime.registry.diagnostics,
    source: params.source,
    owners: params.runtime.channelIdOwners,
    reserved: params.runtime.reservedChannelIds,
    kind: "channel"
  });

  if (accepted.length === 0) {
    return;
  }

  const channelPlugin = normalizedChannel as PluginRegistry["channels"][number]["channel"];
  params.runtime.registry.channels.push({
    pluginId: params.pluginId,
    channel: channelPlugin,
    source: params.source
  });
  const channelId = accepted[0];
  params.record.channelIds.push(channelId);

  const configSchema = (channelPlugin as { configSchema?: { schema?: unknown; uiHints?: unknown } }).configSchema;
  if (configSchema && typeof configSchema === "object") {
    const schema = configSchema.schema;
    if (schema && typeof schema === "object" && !Array.isArray(schema)) {
      params.record.configJsonSchema = schema as Record<string, unknown>;
      params.record.configSchema = true;
    }
    const uiHints = configSchema.uiHints;
    if (uiHints && typeof uiHints === "object" && !Array.isArray(uiHints)) {
      params.record.configUiHints = {
        ...(params.record.configUiHints ?? {}),
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
      pluginId: params.pluginId,
      diagnostics: params.runtime.registry.diagnostics,
      source: params.source,
      owners: params.runtime.toolNameOwners,
      reserved: params.runtime.reservedToolNames,
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

    params.runtime.registry.tools.push({
      pluginId: params.pluginId,
      factory,
      names: acceptedNames,
      optional,
      source: params.source
    });
    params.record.toolNames.push(...acceptedNames);

    const previewByName = new Map(previewTools.map((tool) => [tool.name, tool]));
    for (const name of acceptedNames) {
      const resolvedTool = previewByName.get(name);
      if (!resolvedTool || params.runtime.resolvedToolNames.has(resolvedTool.name)) {
        continue;
      }
      params.runtime.resolvedToolNames.add(resolvedTool.name);
      params.runtime.registry.resolvedTools.push(resolvedTool);
    }

    params.runtime.registry.diagnostics.push({
      level: "warn",
      pluginId: params.pluginId,
      source: params.source,
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
    pushChannelTools(normalizeToolList(agentTools), false, `channel "${channelId}"`, () => agentTools);
  }
}

function registerPluginProvider(params: {
  runtime: PluginRegisterRuntime;
  record: PluginRecord;
  pluginId: string;
  source: string;
  provider: PluginRegistry["providers"][number]["provider"];
}): void {
  const accepted = ensureUniqueNames({
    names: [params.provider.id],
    pluginId: params.pluginId,
    diagnostics: params.runtime.registry.diagnostics,
    source: params.source,
    owners: params.runtime.providerIdOwners,
    reserved: params.runtime.reservedProviderIds,
    kind: "provider"
  });
  if (accepted.length === 0) {
    return;
  }
  params.runtime.registry.providers.push({
    pluginId: params.pluginId,
    provider: params.provider,
    source: params.source
  });
  params.record.providerIds.push(accepted[0]);
}

export function registerPluginWithApi(params: {
  runtime: PluginRegisterRuntime;
  record: PluginRecord;
  pluginId: string;
  source: string;
  rootDir: string;
  register: (api: OpenClawPluginApi) => void | Promise<void>;
  pluginConfig?: Record<string, unknown>;
}): { ok: true } | { ok: false; error: string } {
  const pluginRuntime = createPluginRuntime({ workspace: params.runtime.workspaceDir, config: params.runtime.config });
  const pluginLogger = buildPluginLogger(params.runtime.logger, params.pluginId);

  const pushUnsupported = (capability: string) => {
    params.runtime.registry.diagnostics.push({
      level: "warn",
      pluginId: params.pluginId,
      source: params.source,
      message: `${capability} is not supported by nextclaw compat layer yet`
    });
    pluginLogger.warn(`${capability} is ignored (not supported yet)`);
  };

  const api: OpenClawPluginApi = {
    id: params.pluginId,
    name: params.record.name,
    version: params.record.version,
    description: params.record.description,
    source: params.source,
    config: params.runtime.config,
    pluginConfig: params.pluginConfig,
    runtime: pluginRuntime,
    logger: pluginLogger,
    registerTool: (tool, opts) => {
      registerPluginTool({
        runtime: params.runtime,
        record: params.record,
        pluginId: params.pluginId,
        source: params.source,
        tool,
        opts
      });
    },
    registerChannel: (registration: OpenClawPluginChannelRegistration) => {
      registerPluginChannel({
        runtime: params.runtime,
        record: params.record,
        pluginId: params.pluginId,
        source: params.source,
        registration
      });
    },
    registerProvider: (provider) => {
      registerPluginProvider({
        runtime: params.runtime,
        record: params.record,
        pluginId: params.pluginId,
        source: params.source,
        provider
      });
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
        return params.rootDir;
      }
      if (path.isAbsolute(trimmed)) {
        return path.resolve(expandHome(trimmed));
      }
      return path.resolve(params.rootDir, trimmed);
    }
  };

  try {
    const result = params.register(api);
    if (result && typeof result === "object" && "then" in result) {
      params.runtime.registry.diagnostics.push({
        level: "warn",
        pluginId: params.pluginId,
        source: params.source,
        message: "plugin register returned a promise; async registration is ignored"
      });
    }
    return { ok: true };
  } catch (err) {
    const error = `plugin failed during register: ${String(err)}`;
    return { ok: false, error };
  }
}

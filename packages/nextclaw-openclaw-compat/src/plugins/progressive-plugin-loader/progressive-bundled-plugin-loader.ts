import { createRequire } from "node:module";
import { BUNDLED_CHANNEL_PLUGIN_PACKAGES } from "../bundled-channel-plugin-packages.constants.js";
import { resolveEnableState } from "../config-state.js";
import { loadBundledPluginModule, resolveBundledPluginEntry } from "../bundled-plugin-loader.js";
import { createPluginRecord } from "../plugin-loader-utils.js";
import { registerPluginWithApi } from "../registry.js";
import type { PluginRegistry, PluginRecord } from "../types.js";
import {
  logPluginStartupTrace,
  markPluginProcessed,
  resolvePackageRootFromEntry,
  resolvePluginModuleExport,
  type ProgressivePluginLoadContext
} from "./progressive-plugin-loader-context.js";

function pushBundledPluginLoadError(registry: PluginRegistry, entryFile: string, error: unknown): void {
  registry.diagnostics.push({
    level: "error",
    source: entryFile,
    message: `failed to load bundled plugin: ${String(error)}`
  });
}

function buildBundledPluginRecord(params: {
  pluginId: string;
  definition: ReturnType<typeof resolvePluginModuleExport>["definition"];
  entryFile: string;
  context: ProgressivePluginLoadContext;
}) {
  return createPluginRecord({
    id: params.pluginId,
    name: params.definition?.name ?? params.pluginId,
    description: params.definition?.description,
    version: params.definition?.version,
    kind: params.definition?.kind,
    source: params.entryFile,
    origin: "bundled",
    workspaceDir: params.context.registerRuntime.workspaceDir,
    enabled: true,
    configSchema: Boolean(params.definition?.configSchema),
    configJsonSchema: params.definition?.configSchema
  });
}

function disableBundledPluginRecord(record: PluginRecord, reason: string): PluginRecord {
  record.status = "disabled";
  record.error = reason;
  return record;
}

function markBundledPluginError(params: {
  record: PluginRecord;
  registry: PluginRegistry;
  pluginId: string;
  entryFile: string;
  message: string;
}): PluginRecord {
  params.record.status = "error";
  params.record.error = params.message;
  params.registry.diagnostics.push({
    level: "error",
    pluginId: params.pluginId,
    source: params.entryFile,
    message: params.message
  });
  return params.record;
}

function finalizeBundledPluginRecord(params: {
  packageName: string;
  pluginId?: string;
  record?: PluginRecord;
  context: ProgressivePluginLoadContext;
  packageStartedAt: number;
}) {
  if (params.record) {
    params.context.registry.plugins.push(params.record);
  }
  logPluginStartupTrace("plugin.loader.bundled_plugin", {
    package: params.packageName,
    plugin_id: params.pluginId,
    duration_ms: Date.now() - params.packageStartedAt
  });
}

function resolveBundledPluginRegistrationCandidate(params: {
  context: ProgressivePluginLoadContext;
  require: NodeRequire;
  packageName: string;
  packageStartedAt: number;
}):
  | { done: true; pluginId?: string }
  | {
      done: false;
      entryFile: string;
      rootDir: string;
      pluginId: string;
      record: PluginRecord;
      register: NonNullable<ReturnType<typeof resolvePluginModuleExport>["register"]>;
    } {
  const resolvedEntry = resolveBundledPluginEntry(
    params.require,
    params.packageName,
    params.context.registry.diagnostics,
    resolvePackageRootFromEntry
  );
  if (!resolvedEntry) {
    return { done: true };
  }

  const { entryFile, rootDir } = resolvedEntry;
  let loadedModule;
  try {
    loadedModule = loadBundledPluginModule(entryFile, rootDir);
  } catch (error) {
    pushBundledPluginLoadError(params.context.registry, entryFile, error);
    return { done: true };
  }

  const resolved = resolvePluginModuleExport(loadedModule);
  const pluginId = typeof resolved.definition?.id === "string" ? resolved.definition.id.trim() : "";
  if (!pluginId) {
    params.context.registry.diagnostics.push({
      level: "error",
      source: entryFile,
      message: "bundled plugin definition missing id"
    });
    return { done: true };
  }

  const enableState = resolveEnableState(pluginId, params.context.normalizedConfig);
  const record = buildBundledPluginRecord({
    pluginId,
    definition: resolved.definition,
    entryFile,
    context: params.context
  });

  if (!enableState.enabled) {
    finalizeBundledPluginRecord({
      packageName: params.packageName,
      pluginId,
      record: disableBundledPluginRecord(record, enableState.reason ?? "disabled"),
      context: params.context,
      packageStartedAt: params.packageStartedAt
    });
    return { done: true, pluginId };
  }

  if (typeof resolved.register !== "function") {
    finalizeBundledPluginRecord({
      packageName: params.packageName,
      pluginId,
      record: markBundledPluginError({
        record,
        registry: params.context.registry,
        pluginId,
        entryFile,
        message: "plugin export missing register/activate"
      }),
      context: params.context,
      packageStartedAt: params.packageStartedAt
    });
    return { done: true, pluginId };
  }

  return {
    done: false,
    entryFile,
    rootDir,
    pluginId,
    record,
    register: resolved.register
  };
}

async function processBundledPluginPackage(
  context: ProgressivePluginLoadContext,
  require: NodeRequire,
  packageName: string
): Promise<void> {
  const packageStartedAt = Date.now();
  const candidate = resolveBundledPluginRegistrationCandidate({
    context,
    require,
    packageName,
    packageStartedAt
  });
  if (candidate.done) {
    await markPluginProcessed(context.tracker, candidate.pluginId);
    return;
  }

  const result = registerPluginWithApi({
    runtime: context.registerRuntime,
    record: candidate.record,
    pluginId: candidate.pluginId,
    source: candidate.entryFile,
    rootDir: candidate.rootDir,
    register: candidate.register,
    pluginConfig: undefined
  });
  if (!result.ok) {
    markBundledPluginError({
      record: candidate.record,
      registry: context.registry,
      pluginId: candidate.pluginId,
      entryFile: candidate.entryFile,
      message: result.error
    });
  }

  finalizeBundledPluginRecord({
    packageName,
    pluginId: candidate.pluginId,
    record: candidate.record,
    context,
    packageStartedAt
  });
  await markPluginProcessed(context.tracker, candidate.pluginId);
}

export async function appendBundledChannelPluginsProgressively(context: ProgressivePluginLoadContext): Promise<void> {
  const require = createRequire(import.meta.url);
  for (const packageName of BUNDLED_CHANNEL_PLUGIN_PACKAGES) {
    await processBundledPluginPackage(context, require, packageName);
  }
}

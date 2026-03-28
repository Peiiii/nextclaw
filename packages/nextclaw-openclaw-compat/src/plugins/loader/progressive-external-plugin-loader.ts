import { filterPluginCandidatesByExcludedRoots } from "../candidate-filter.js";
import { resolveEnableState } from "../config-state.js";
import { discoverOpenClawPlugins, type PluginCandidate } from "../discovery.js";
import { loadPluginManifestRegistry, type PluginManifestRecord } from "../manifest-registry.js";
import { createPluginRecord, validatePluginConfig } from "../plugin-loader-utils.js";
import { registerPluginWithApi } from "../registry.js";
import type { PluginRecord } from "../types.js";
import {
  loadExternalPluginModule,
  logPluginStartupTrace,
  markPluginProcessed,
  resolvePluginModuleExport,
  type ProgressivePluginLoadContext
} from "./progressive-plugin-loader-context.js";

function createManifestPluginRecord(manifest: PluginManifestRecord, candidate: PluginCandidate, enabled: boolean): PluginRecord {
  return createPluginRecord({
    id: manifest.id,
    name: manifest.name ?? manifest.id,
    description: manifest.description,
    version: manifest.version,
    kind: manifest.kind,
    source: candidate.source,
    origin: candidate.origin,
    workspaceDir: candidate.workspaceDir,
    enabled,
    configSchema: Boolean(manifest.configSchema),
    configUiHints: manifest.configUiHints,
    configJsonSchema: manifest.configSchema
  });
}

async function finalizeExternalPluginRecord(params: {
  context: ProgressivePluginLoadContext;
  record: PluginRecord;
  pluginId?: string;
  seenIds?: Map<string, PluginRecord["origin"]>;
  origin?: PluginRecord["origin"];
}): Promise<void> {
  params.context.registry.plugins.push(params.record);
  if (params.pluginId && params.seenIds && params.origin) {
    params.seenIds.set(params.pluginId, params.origin);
  }
  await markPluginProcessed(params.context.tracker, params.pluginId);
}

async function finalizeExternalPluginError(params: {
  context: ProgressivePluginLoadContext;
  record: PluginRecord;
  candidate: PluginCandidate;
  pluginId: string;
  seenIds: Map<string, PluginRecord["origin"]>;
  message: string;
}): Promise<void> {
  params.record.status = "error";
  params.record.error = params.message;
  params.context.registry.diagnostics.push({
    level: "error",
    pluginId: params.pluginId,
    source: params.candidate.source,
    message: params.message
  });
  await finalizeExternalPluginRecord({
    context: params.context,
    record: params.record,
    pluginId: params.pluginId,
    seenIds: params.seenIds,
    origin: params.candidate.origin
  });
}

async function finalizeDisabledExternalPlugin(params: {
  context: ProgressivePluginLoadContext;
  record: PluginRecord;
  candidate: PluginCandidate;
  pluginId: string;
  seenIds: Map<string, PluginRecord["origin"]>;
  reason: string;
}): Promise<void> {
  params.record.status = "disabled";
  params.record.error = params.reason;
  await finalizeExternalPluginRecord({
    context: params.context,
    record: params.record,
    pluginId: params.pluginId,
    seenIds: params.seenIds,
    origin: params.candidate.origin
  });
}

function applyDefinitionMetadata(record: PluginRecord, definition?: ReturnType<typeof resolvePluginModuleExport>["definition"]): void {
  record.name = definition?.name ?? record.name;
  record.description = definition?.description ?? record.description;
  record.version = definition?.version ?? record.version;
  record.kind = definition?.kind ?? record.kind;
}

function loadExternalPluginDefinition(params: {
  context: ProgressivePluginLoadContext;
  candidate: PluginCandidate;
  pluginId: string;
}) {
  const moduleLoadStartedAt = Date.now();
  const loadedModule = loadExternalPluginModule(params.candidate.source, params.candidate.rootDir);
  logPluginStartupTrace("plugin.loader.external_module_loaded", {
    plugin_id: params.pluginId,
    duration_ms: Date.now() - moduleLoadStartedAt,
    source: params.candidate.source
  });
  return resolvePluginModuleExport(loadedModule);
}

function pushDefinitionMismatchWarning(
  context: ProgressivePluginLoadContext,
  candidate: PluginCandidate,
  pluginId: string,
  definitionId?: string
): void {
  if (!definitionId || definitionId === pluginId) {
    return;
  }
  context.registry.diagnostics.push({
    level: "warn",
    pluginId,
    source: candidate.source,
    message: `plugin id mismatch (manifest uses "${pluginId}", export uses "${definitionId}")`
  });
}

async function loadAndRegisterExternalPlugin(params: {
  context: ProgressivePluginLoadContext;
  candidate: PluginCandidate;
  record: PluginRecord;
  pluginId: string;
  seenIds: Map<string, PluginRecord["origin"]>;
  validatedConfig: Extract<ReturnType<typeof validatePluginConfig>, { ok: true }>;
  candidateStartedAt: number;
}): Promise<void> {
  let resolved;
  try {
    resolved = loadExternalPluginDefinition({
      context: params.context,
      candidate: params.candidate,
      pluginId: params.pluginId
    });
  } catch (error) {
    await finalizeExternalPluginError({
      context: params.context,
      record: params.record,
      candidate: params.candidate,
      pluginId: params.pluginId,
      seenIds: params.seenIds,
      message: `failed to load plugin: ${String(error)}`
    });
    return;
  }

  pushDefinitionMismatchWarning(params.context, params.candidate, params.pluginId, resolved.definition?.id);
  applyDefinitionMetadata(params.record, resolved.definition);
  if (typeof resolved.register !== "function") {
    await finalizeExternalPluginError({
      context: params.context,
      record: params.record,
      candidate: params.candidate,
      pluginId: params.pluginId,
      seenIds: params.seenIds,
      message: "plugin export missing register/activate"
    });
    return;
  }

  const registerResult = registerPluginWithApi({
    runtime: params.context.registerRuntime,
    record: params.record,
    pluginId: params.pluginId,
    source: params.candidate.source,
    rootDir: params.candidate.rootDir,
    register: resolved.register,
    pluginConfig: params.validatedConfig.value
  });
  logPluginStartupTrace("plugin.loader.external_plugin_registered", {
    plugin_id: params.pluginId,
    duration_ms: Date.now() - params.candidateStartedAt,
    source: params.candidate.source
  });
  if (!registerResult.ok) {
    await finalizeExternalPluginError({
      context: params.context,
      record: params.record,
      candidate: params.candidate,
      pluginId: params.pluginId,
      seenIds: params.seenIds,
      message: registerResult.error
    });
    return;
  }

  await finalizeExternalPluginRecord({
    context: params.context,
    record: params.record,
    pluginId: params.pluginId,
    seenIds: params.seenIds,
    origin: params.candidate.origin
  });
}

async function processExternalPluginCandidate(params: {
  context: ProgressivePluginLoadContext;
  candidate: PluginCandidate;
  manifest: PluginManifestRecord;
  seenIds: Map<string, PluginRecord["origin"]>;
}): Promise<void> {
  const candidateStartedAt = Date.now();
  const pluginId = params.manifest.id;
  const existingOrigin = params.seenIds.get(pluginId);
  if (existingOrigin) {
    const overriddenRecord = createManifestPluginRecord(params.manifest, params.candidate, false);
    overriddenRecord.status = "disabled";
    overriddenRecord.error = `overridden by ${existingOrigin} plugin`;
    await finalizeExternalPluginRecord({
      context: params.context,
      record: overriddenRecord,
      pluginId
    });
    return;
  }

  const enableState = resolveEnableState(pluginId, params.context.normalizedConfig);
  const record = createManifestPluginRecord(params.manifest, params.candidate, enableState.enabled);
  if (!enableState.enabled) {
    await finalizeDisabledExternalPlugin({
      context: params.context,
      record,
      candidate: params.candidate,
      pluginId,
      seenIds: params.seenIds,
      reason: enableState.reason ?? "disabled"
    });
    return;
  }

  if (!params.manifest.configSchema) {
    await finalizeExternalPluginError({
      context: params.context,
      record,
      candidate: params.candidate,
      pluginId,
      seenIds: params.seenIds,
      message: "missing config schema"
    });
    return;
  }

  const validatedConfig = validatePluginConfig({
    schema: params.manifest.configSchema,
    cacheKey: params.manifest.schemaCacheKey,
    value: params.context.normalizedConfig.entries[pluginId]?.config
  });
  if (!validatedConfig.ok) {
    await finalizeExternalPluginError({
      context: params.context,
      record,
      candidate: params.candidate,
      pluginId,
      seenIds: params.seenIds,
      message: `invalid config: ${validatedConfig.errors.join(", ")}`
    });
    return;
  }

  if (params.context.mode === "validate") {
    await finalizeExternalPluginRecord({
      context: params.context,
      record,
      pluginId,
      seenIds: params.seenIds,
      origin: params.candidate.origin
    });
    return;
  }

  await loadAndRegisterExternalPlugin({
    context: params.context,
    candidate: params.candidate,
    record,
    pluginId,
    seenIds: params.seenIds,
    validatedConfig,
    candidateStartedAt
  });
}

export async function appendExternalPluginsProgressively(context: ProgressivePluginLoadContext): Promise<void> {
  const discovery = discoverOpenClawPlugins({
    config: context.options.config,
    workspaceDir: context.workspaceDir,
    extraPaths: context.normalizedConfig.loadPaths
  });
  const filteredCandidates = filterPluginCandidatesByExcludedRoots(discovery.candidates, context.options.excludeRoots ?? []);
  const manifestRegistry = loadPluginManifestRegistry({
    config: context.options.config,
    workspaceDir: context.workspaceDir,
    candidates: filteredCandidates,
    diagnostics: discovery.diagnostics
  });
  context.registry.diagnostics.push(...manifestRegistry.diagnostics);

  const manifestByRoot = new Map(manifestRegistry.plugins.map((entry) => [entry.rootDir, entry]));
  const seenIds = new Map<string, PluginRecord["origin"]>(
    context.registry.plugins.map((entry) => [entry.id, entry.origin])
  );

  for (const candidate of filteredCandidates) {
    const manifest = manifestByRoot.get(candidate.rootDir);
    if (!manifest) {
      await markPluginProcessed(context.tracker);
      continue;
    }
    await processExternalPluginCandidate({
      context,
      candidate,
      manifest,
      seenIds
    });
  }
}

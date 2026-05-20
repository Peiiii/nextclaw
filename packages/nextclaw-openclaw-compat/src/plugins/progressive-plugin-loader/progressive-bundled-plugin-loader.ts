import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BUNDLED_CHANNEL_PLUGIN_PACKAGES } from "../bundled-channel-plugin-packages.constants.js";
import { loadInProcessBundledPluginModule } from "../bundled-channel-plugin-module.utils.js";
import { resolveEnableState } from "../config-state.js";
import { loadBundledPluginModule, resolveBundledPluginEntry } from "../bundled-plugin-loader.js";
import { getPackageManifestExtensions, type PackageManifest } from "../manifest.js";
import { createPluginRecord } from "../plugin-loader.utils.js";
import { registerPluginWithApi } from "../openclaw-plugin-registry.utils.js";
import type { PluginRegistry, PluginRecord } from "../types.js";
import {
  logPluginStartupTrace,
  markPluginProcessed,
  resolvePackageRootFromEntry,
  resolvePluginModuleExport,
  type ProgressivePluginLoadContext
} from "./progressive-plugin-loader-context.js";

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

function resolveProgressiveBundledEntryFile(rootDir: string, entryFile: string): string {
  const manifestPath = path.join(rootDir, "package.json");
  if (!fs.existsSync(manifestPath)) {
    return entryFile;
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as PackageManifest;
    const [productionEntry] = getPackageManifestExtensions(manifest, "production");
    if (!productionEntry) {
      return entryFile;
    }
    const productionEntryFile = path.resolve(rootDir, productionEntry);
    return fs.existsSync(productionEntryFile) ? productionEntryFile : entryFile;
  } catch {
    return entryFile;
  }
}

async function resolveBundledPluginRegistrationCandidate(params: {
  context: ProgressivePluginLoadContext;
  require: NodeRequire;
  packageName: string;
  packageStartedAt: number;
}): Promise<
  | { done: true; pluginId?: string }
  | {
      done: false;
      entryFile: string;
      rootDir: string;
      pluginId: string;
      record: PluginRecord;
      register: NonNullable<ReturnType<typeof resolvePluginModuleExport>["register"]>;
    }
> {
  const { context, packageName, packageStartedAt, require } = params;
  const resolvedEntry = resolveBundledPluginEntry(
    require,
    packageName,
    [],
    resolvePackageRootFromEntry
  );

  const inProcessModule = resolvedEntry ? null : await loadInProcessBundledPluginModule(packageName);
  if (!resolvedEntry && !inProcessModule) {
    context.registry.diagnostics.push({
      level: "error",
      source: packageName,
      message: "bundled plugin package not resolvable"
    });
    return { done: true };
  }

  const rootDir = resolvedEntry?.rootDir ?? inProcessModule?.rootDir ?? "";
  const entryFile = resolvedEntry
    ? resolveProgressiveBundledEntryFile(rootDir, resolvedEntry.entryFile)
    : inProcessModule?.entryFile ?? "";
  try {
    const moduleExport = inProcessModule
      ? inProcessModule.module
      : [".js", ".mjs", ".cjs"].includes(path.extname(entryFile).toLowerCase())
        ? await import(pathToFileURL(entryFile).href)
        : loadBundledPluginModule(entryFile, rootDir);
    const resolved = resolvePluginModuleExport(moduleExport);
    const pluginId = typeof resolved.definition?.id === "string" ? resolved.definition.id.trim() : "";
    if (!pluginId) {
      context.registry.diagnostics.push({
        level: "error",
        source: entryFile,
        message: "bundled plugin definition missing id"
      });
      return { done: true };
    }

    const enableState = resolveEnableState(pluginId, context.normalizedConfig);
    const record = buildBundledPluginRecord({
      pluginId,
      definition: resolved.definition,
      entryFile,
      context
    });

    if (!enableState.enabled) {
      finalizeBundledPluginRecord({
        packageName,
        pluginId,
        record: Object.assign(record, { status: "disabled", error: enableState.reason ?? "disabled" }),
        context,
        packageStartedAt
      });
      return { done: true, pluginId };
    }

    if (typeof resolved.register !== "function") {
      finalizeBundledPluginRecord({
        packageName,
        pluginId,
        record: markBundledPluginError({
          record,
          registry: context.registry,
          pluginId,
          entryFile,
          message: "plugin export missing register/activate"
        }),
        context,
        packageStartedAt
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
  } catch (error) {
    context.registry.diagnostics.push({
      level: "error",
      source: entryFile,
      message: `failed to load bundled plugin: ${String(error)}`
    });
    return { done: true };
  }
}

async function processBundledPluginPackage(
  context: ProgressivePluginLoadContext,
  require: NodeRequire,
  packageName: string
): Promise<void> {
  const { registry, registerRuntime, tracker } = context;
  const packageStartedAt = Date.now();
  const candidate = await resolveBundledPluginRegistrationCandidate({
    context,
    require,
    packageName,
    packageStartedAt
  });
  if (candidate.done) {
    await markPluginProcessed(tracker, candidate.pluginId);
    return;
  }

  const result = registerPluginWithApi({
    runtime: registerRuntime,
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
      registry,
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
  await markPluginProcessed(tracker, candidate.pluginId);
}

export async function appendBundledChannelPluginsProgressively(context: ProgressivePluginLoadContext): Promise<void> {
  const require = createRequire(import.meta.url);
  for (const packageName of BUNDLED_CHANNEL_PLUGIN_PACKAGES) {
    await processBundledPluginPackage(context, require, packageName);
  }
}

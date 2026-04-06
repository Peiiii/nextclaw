import fs from "node:fs";
import path from "node:path";
import { setImmediate as waitForNextTick } from "node:timers/promises";
import { getWorkspacePathFromConfig, type Config } from "@nextclaw/core";
import { normalizePluginsConfig, type NormalizedPluginsConfig } from "../config-state.js";
import { buildPluginLoaderAliases } from "../plugin-loader-aliases.js";
import { createPluginJiti } from "../plugin-loader-jiti.js";
import { createPluginRegisterRuntime, type PluginRegisterRuntime } from "../registry.js";
import type {
  OpenClawPluginDefinition,
  OpenClawPluginModule,
  PluginLogger,
  PluginRegistry
} from "../types.js";

export type ProgressivePluginLoadOptions = {
  config: Config;
  workspaceDir?: string;
  logger?: PluginLogger;
  mode?: "full" | "validate";
  excludeRoots?: string[];
  reservedToolNames?: string[];
  reservedChannelIds?: string[];
  reservedProviderIds?: string[];
  reservedEngineKinds?: string[];
  reservedNcpAgentRuntimeKinds?: string[];
  onPluginProcessed?: (params: { loadedPluginCount: number; pluginId?: string }) => void;
  yieldToEventLoop?: () => Promise<void>;
};

export type ProgressiveLoadTracker = {
  loadedPluginCount: number;
  onPluginProcessed?: ProgressivePluginLoadOptions["onPluginProcessed"];
  yieldToEventLoop: () => Promise<void>;
};

export type ProgressivePluginLoadContext = {
  options: ProgressivePluginLoadOptions;
  workspaceDir: string;
  normalizedConfig: NormalizedPluginsConfig;
  mode: "full" | "validate";
  registry: PluginRegistry;
  registerRuntime: PluginRegisterRuntime;
  tracker: ProgressiveLoadTracker;
};

const defaultLogger: PluginLogger = {
  info: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
  error: (message: string) => console.error(message),
  debug: (message: string) => console.debug(message)
};

const STARTUP_TRACE_ENABLED = process.env.NEXTCLAW_STARTUP_TRACE === "1";

export function logPluginStartupTrace(step: string, fields?: Record<string, string | number | boolean | undefined>): void {
  if (!STARTUP_TRACE_ENABLED) {
    return;
  }
  const suffix = Object.entries(fields ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  console.log(`[startup-trace] ${step}${suffix ? ` ${suffix}` : ""}`);
}

export function resolvePackageRootFromEntry(entryFile: string): string {
  let cursor = path.dirname(entryFile);
  for (let index = 0; index < 8; index += 1) {
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

export function resolvePluginModuleExport(moduleExport: unknown): {
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

export function loadExternalPluginModule(candidateSource: string, pluginRoot: string): OpenClawPluginModule {
  const pluginJiti = createPluginJiti(buildPluginLoaderAliases(pluginRoot));
  return pluginJiti(candidateSource) as OpenClawPluginModule;
}

function createEmptyPluginRegistry(): PluginRegistry {
  return {
    plugins: [],
    tools: [],
    channels: [],
    providers: [],
    engines: [],
    ncpAgentRuntimes: [],
    diagnostics: [],
    resolvedTools: []
  };
}

function createRegisterRuntimeFromOptions(options: ProgressivePluginLoadOptions, registry: PluginRegistry, workspaceDir: string) {
  const logger = options.logger ?? defaultLogger;
  return createPluginRegisterRuntime({
    config: options.config,
    workspaceDir,
    logger,
    registry,
    reservedToolNames: new Set(options.reservedToolNames ?? []),
    reservedChannelIds: new Set(options.reservedChannelIds ?? []),
    reservedProviderIds: new Set(options.reservedProviderIds ?? []),
    reservedEngineKinds: new Set((options.reservedEngineKinds ?? ["native"]).map((entry) => entry.toLowerCase())),
    reservedNcpAgentRuntimeKinds: new Set(
      (options.reservedNcpAgentRuntimeKinds ?? ["native"]).map((entry) => entry.toLowerCase())
    )
  });
}

export function createProgressivePluginLoadContext(options: ProgressivePluginLoadOptions): ProgressivePluginLoadContext {
  const workspaceDir = options.workspaceDir?.trim() || getWorkspacePathFromConfig(options.config);
  const normalizedConfig = normalizePluginsConfig(options.config.plugins);
  const registry = createEmptyPluginRegistry();

  return {
    options,
    workspaceDir,
    normalizedConfig,
    mode: options.mode ?? "full",
    registry,
    registerRuntime: createRegisterRuntimeFromOptions(options, registry, workspaceDir),
    tracker: {
      loadedPluginCount: 0,
      onPluginProcessed: options.onPluginProcessed,
      yieldToEventLoop: options.yieldToEventLoop ?? (() => waitForNextTick())
    }
  };
}

export async function markPluginProcessed(tracker: ProgressiveLoadTracker, pluginId?: string): Promise<void> {
  tracker.loadedPluginCount += 1;
  tracker.onPluginProcessed?.({
    loadedPluginCount: tracker.loadedPluginCount,
    ...(pluginId ? { pluginId } : {})
  });
  await tracker.yieldToEventLoop();
}

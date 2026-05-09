import chokidar from "chokidar";
import { resolve, sep } from "node:path";
import type { ServiceFileWatcherRegistry } from "@nextclaw-service/shared/services/gateway/service-startup-support.js";

export const DEV_PLUGIN_HOT_RELOAD_TARGETS_ENV = "NEXTCLAW_DEV_PLUGIN_HOT_RELOAD_TARGETS";

export type DevPluginHotReloadTarget = {
  pluginId: string;
  pluginPath: string;
  watchPaths: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeWatchPaths(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const watchPaths: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalString(entry);
    if (!normalized) {
      continue;
    }
    const resolvedPath = resolve(normalized);
    if (!watchPaths.includes(resolvedPath)) {
      watchPaths.push(resolvedPath);
    }
  }
  return watchPaths;
}

export function resolveDevPluginHotReloadTargets(
  rawValue = process.env[DEV_PLUGIN_HOT_RELOAD_TARGETS_ENV],
): DevPluginHotReloadTarget[] {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch (error) {
    throw new Error(
      `[dev-plugin-hot-reload] failed to parse ${DEV_PLUGIN_HOT_RELOAD_TARGETS_ENV}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `[dev-plugin-hot-reload] ${DEV_PLUGIN_HOT_RELOAD_TARGETS_ENV} must be a JSON array`,
    );
  }

  const seenPluginIds = new Set<string>();
  const targets: DevPluginHotReloadTarget[] = [];
  for (const entry of parsed) {
    if (!isRecord(entry)) {
      continue;
    }
    const pluginId = readOptionalString(entry.pluginId);
    const pluginPath = readOptionalString(entry.pluginPath);
    const watchPaths = normalizeWatchPaths(entry.watchPaths);
    if (!pluginId || !pluginPath || watchPaths.length === 0) {
      continue;
    }
    if (seenPluginIds.has(pluginId)) {
      throw new Error(
        `[dev-plugin-hot-reload] duplicate plugin target for "${pluginId}"`,
      );
    }
    seenPluginIds.add(pluginId);
    targets.push({
      pluginId,
      pluginPath: resolve(pluginPath),
      watchPaths,
    });
  }
  return targets;
}

export function startDevPluginHotReloadWatcher(params: {
  watcherRegistry: ServiceFileWatcherRegistry;
  reloadPlugins: (pluginIds: string[]) => Promise<void>;
  targets?: DevPluginHotReloadTarget[];
}): void {
  const targets = params.targets ?? resolveDevPluginHotReloadTargets();
  if (targets.length === 0) {
    return;
  }

  const pendingPluginIds = new Set<string>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let reloadRunning = false;
  let reloadPending = false;

  const flushReload = async (): Promise<void> => {
    if (reloadRunning) {
      reloadPending = true;
      return;
    }
    const pluginIds = [...pendingPluginIds];
    pendingPluginIds.clear();
    if (pluginIds.length === 0) {
      return;
    }

    reloadRunning = true;
    try {
      console.log(`[dev] Plugin dist updated: ${pluginIds.join(", ")}`);
      await params.reloadPlugins(pluginIds);
      console.log(`[dev] Plugin hot reload applied: ${pluginIds.join(", ")}`);
    } catch (error) {
      console.error(
        `[dev] Plugin hot reload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      reloadRunning = false;
      if (reloadPending || pendingPluginIds.size > 0) {
        reloadPending = false;
        await flushReload();
      }
    }
  };

  const scheduleReload = (pluginId: string): void => {
    pendingPluginIds.add(pluginId);
    if (flushTimer) {
      clearTimeout(flushTimer);
    }
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushReload();
    }, 150);
  };

  const watcher = chokidar.watch(
    targets.flatMap((entry) => entry.watchPaths),
    {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    },
  );
  params.watcherRegistry.remember(watcher);
  watcher.on("all", (_event, changedPath) => {
    const normalizedChangedPath = resolve(changedPath);
    for (const target of targets) {
      if (
        target.watchPaths.some((watchPath) =>
          normalizedChangedPath === watchPath ||
          normalizedChangedPath.startsWith(`${watchPath}${sep}`),
        )
      ) {
        scheduleReload(target.pluginId);
      }
    }
  });

  console.log(
    `[dev] Plugin hot reload watcher: ${targets.map((entry) => entry.pluginId).join(", ")}`,
  );
}

export function wrapStartChannelsWithDevPluginHotReload(params: {
  startChannels: () => Promise<void>;
  watcherRegistry: ServiceFileWatcherRegistry;
  isRuntimeActive: () => boolean;
  reloadPlugins: (pluginIds: string[]) => Promise<void>;
  startupSettleMs: number;
}): () => Promise<void> {
  return async () => {
    await params.startChannels();
    console.log(
      `[dev] Plugin hot reload watcher will arm after ${params.startupSettleMs}ms startup settle window.`,
    );
    const timer = setTimeout(() => {
      if (!params.isRuntimeActive()) {
        return;
      }
      startDevPluginHotReloadWatcher({
        watcherRegistry: params.watcherRegistry,
        reloadPlugins: params.reloadPlugins,
      });
    }, params.startupSettleMs);
    timer.unref?.();
  };
}

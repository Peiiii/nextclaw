import type { Config } from "@nextclaw/core";
import type { startPluginChannelGateways } from "@nextclaw/openclaw-compat";
import type { RemoteServiceModule } from "@nextclaw/remote";
import chokidar, { type FSWatcher } from "chokidar";
import { resolve } from "node:path";
import { localUiRuntimeStore } from "../../../shared/stores/local-ui-runtime.store.js";

export const pluginGatewayLogger = {
  info: (message: string) => console.log(`[plugins] ${message}`),
  warn: (message: string) => console.warn(`[plugins] ${message}`),
  error: (message: string) => console.error(`[plugins] ${message}`),
  debug: (message: string) => console.debug(`[plugins] ${message}`)
};

export function logPluginGatewayDiagnostics(
  diagnostics: Awaited<ReturnType<typeof startPluginChannelGateways>>["diagnostics"]
): void {
  for (const diag of diagnostics) {
    const prefix = diag.pluginId ? `${diag.pluginId}: ` : "";
    const text = `${prefix}${diag.message}`;
    if (diag.level === "error") {
      console.error(`[plugins] ${text}`);
    } else {
      console.warn(`[plugins] ${text}`);
    }
  }
}

export async function startGatewaySupportServices(params: {
  cronJobs: number;
  remoteModule: RemoteServiceModule | null;
  watchConfigFile: () => void;
  startCron: () => Promise<void>;
  startHeartbeat: () => Promise<void>;
}): Promise<void> {
  if (params.cronJobs > 0) {
    console.log(`✓ Cron: ${params.cronJobs} scheduled jobs`);
  }
  console.log("✓ Heartbeat: every 30m");
  params.remoteModule?.start();
  params.watchConfigFile();
  await params.startCron();
  await params.startHeartbeat();
}

export function watchCronStoreFile(params: {
  cronStorePath: string;
  reloadCronStore: () => void;
}): FSWatcher {
  const cronStorePath = resolve(params.cronStorePath);
  const watcher = chokidar.watch(cronStorePath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
  });
  watcher.on("all", (event, changedPath) => {
    if (resolve(changedPath) !== cronStorePath) {
      return;
    }
    if (event === "add" || event === "change" || event === "unlink") {
      try {
        params.reloadCronStore();
      } catch (error) {
        console.error(`Cron store reload failed (${event}): ${String(error)}`);
      }
    }
  });
  return watcher;
}

export function watchServiceConfigFile(params: {
  configPath: string;
  watcherRegistry: ServiceFileWatcherRegistry;
  scheduleReload: (reason: string) => void;
}): void {
  const configPath = resolve(params.configPath);
  const watcher = chokidar.watch(configPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
  });
  params.watcherRegistry.remember(watcher);
  watcher.on("all", (event, changedPath) => {
    if (resolve(changedPath) !== configPath) {
      return;
    }
    if (event === "add") {
      params.scheduleReload("config add");
      return;
    }
    if (event === "change") {
      params.scheduleReload("config change");
      return;
    }
    if (event === "unlink") {
      params.scheduleReload("config unlink");
    }
  });
}

export class ServiceFileWatcherRegistry {
  private readonly watchers: FSWatcher[] = [];

  readonly remember = (watcher: FSWatcher): void => {
    this.watchers.push(watcher);
  };

  readonly clear = async (): Promise<void> => {
    const watchers = this.watchers.splice(0);
    await Promise.allSettled(watchers.map(async (watcher) => {
      try {
        await watcher.close();
      } catch {
        void 0;
      }
    }));
  };
}

export function finalizeLocalUiStartup<TEvent>(params: {
  uiStartup: { publish?: ((event: TEvent) => void) | undefined } | null | undefined;
  setUiEventPublisher: (publish: ((event: TEvent) => void) | undefined) => void;
  uiConfig: Pick<Config["ui"], "host" | "port">;
}): void {
  const { setUiEventPublisher, uiConfig, uiStartup } = params;
  setUiEventPublisher(uiStartup?.publish);
  if (uiStartup) {
    localUiRuntimeStore.writeCurrentProcess(uiConfig);
  }
}

export async function startGatewayRuntimeSupport(params: {
  cronJobs: number;
  remoteModule: RemoteServiceModule | null;
  watchConfigFile: () => void;
  startCron: () => Promise<void>;
  startHeartbeat: () => Promise<void>;
  cronStorePath: string;
  reloadCronStore: () => void;
  watcherRegistry: ServiceFileWatcherRegistry;
}): Promise<void> {
  const {
    cronJobs,
    cronStorePath,
    reloadCronStore,
    remoteModule,
    startCron,
    startHeartbeat,
    watchConfigFile,
    watcherRegistry
  } = params;
  await startGatewaySupportServices({
    cronJobs,
    remoteModule,
    watchConfigFile,
    startCron,
    startHeartbeat
  });
  watcherRegistry.remember(
    watchCronStoreFile({
      cronStorePath,
      reloadCronStore
    })
  );
}

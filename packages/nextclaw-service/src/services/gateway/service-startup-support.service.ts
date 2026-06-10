import type { Config } from "@nextclaw/core";
import type { AutomationManager } from "@nextclaw/kernel";
import type { RemoteServiceModule } from "@nextclaw/remote";
import chokidar, { type FSWatcher } from "chokidar";
import { resolve } from "node:path";
import { localUiRuntimeStore } from "@nextclaw-service/stores/local-ui-runtime.store.js";

export async function startGatewaySupportServices(params: {
  automation: AutomationManager;
  remoteModule: RemoteServiceModule | null;
  watchConfigFile: () => void;
}): Promise<void> {
  const { automation, remoteModule, watchConfigFile } = params;
  const cronJobs = automation.status().jobs;
  if (cronJobs > 0) {
    console.log(`✓ Cron: ${cronJobs} scheduled jobs`);
  }
  remoteModule?.start();
  watchConfigFile();
  await automation.start();
}

export function watchCronStoreFile(automation: AutomationManager): FSWatcher {
  const cronStorePath = resolve(automation.storePath);
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
        automation.reloadFromStore();
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

export function markLocalUiRuntimeIfStarted(params: {
  uiStartup: unknown | null | undefined;
  uiConfig: Pick<Config["ui"], "host" | "port">;
}): void {
  const { uiConfig, uiStartup } = params;
  if (uiStartup) {
    localUiRuntimeStore.writeCurrentProcess(uiConfig);
  }
}

export async function startGatewayRuntimeSupport(params: {
  automation: AutomationManager;
  remoteModule: RemoteServiceModule | null;
  watchConfigFile: () => void;
  watcherRegistry: ServiceFileWatcherRegistry;
}): Promise<void> {
  const {
    automation,
    remoteModule,
    watchConfigFile,
    watcherRegistry
  } = params;
  await startGatewaySupportServices({
    automation,
    remoteModule,
    watchConfigFile
  });
  watcherRegistry.remember(watchCronStoreFile(automation));
}

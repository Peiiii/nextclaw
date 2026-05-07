import type { Config } from "@nextclaw/core";
import { eventKeys, nextclaw } from "@nextclaw/kernel";
import type { UpdatePreferences, UpdateProgress, UpdateSnapshot } from "@nextclaw/kernel/update-contract";
import type { UiRuntimeUpdateHost } from "@nextclaw/server";
import { getPackageVersion } from "@/cli/shared/utils/cli.utils.js";
import { NpmRuntimeBundleLayoutStore } from "@/cli/launcher/npm-runtime-bundle-layout.store.js";
import { NpmRuntimeBundleService } from "@/cli/launcher/npm-runtime-bundle.service.js";
import { NpmRuntimeUpdateManager } from "@/cli/launcher/npm-runtime-update.manager.js";
import { NpmRuntimeUpdateService } from "@/cli/launcher/npm-runtime-update.service.js";
import { NpmRuntimeUpdateSourceService } from "@/cli/launcher/npm-runtime-update-source.service.js";
import { NpmRuntimeUpdateStateStore } from "@/cli/launcher/npm-runtime-update-state.store.js";
import { requestManagedServiceRestart } from "@/cli/shared/services/ui/service-remote-access.service.js";
import type { RequestRestartParams } from "@/cli/shared/types/cli.types.js";

const INITIAL_DOWNLOAD_PROGRESS: UpdateProgress = {
  downloadedBytes: 0,
  totalBytes: null,
  percent: null
};

type NpmRuntimeUpdateHostDeps = {
  requestRestart: (params: RequestRestartParams) => Promise<void>;
  uiConfig: Pick<Config["ui"], "port">;
  applyRestartMode: "managed-service-restart" | "manual-process-restart";
};

export class NpmRuntimeUpdateHost implements UiRuntimeUpdateHost {
  private readonly source = new NpmRuntimeUpdateSourceService();
  private readonly layout = new NpmRuntimeBundleLayoutStore();
  private readonly launcherVersion = getPackageVersion();
  private readonly stateStore = new NpmRuntimeUpdateStateStore(this.layout.getStatePath(), {
    defaultChannel: this.source.resolveChannel(undefined, this.launcherVersion)
  });
  private readonly bundleService = new NpmRuntimeBundleService({
    layout: this.layout,
    stateStore: this.stateStore,
    launcherVersion: this.launcherVersion
  });
  private readonly updateService = new NpmRuntimeUpdateService({
    layout: this.layout,
    bundleService: this.bundleService,
    launcherVersion: this.launcherVersion,
    bundlePublicKey: this.source.resolveBundlePublicKey() ?? undefined
  });
  private snapshot: UpdateSnapshot;
  private activeTask: Promise<void> | null = null;
  private automaticSyncStarted = false;

  constructor(private readonly deps: NpmRuntimeUpdateHostDeps) {
    this.snapshot = this.createManager().getSnapshot();
    this.startAutomaticSync();
  }

  getState = async (): Promise<UpdateSnapshot> => {
    this.startAutomaticSync();
    return this.snapshot;
  };

  checkForUpdates = async (): Promise<UpdateSnapshot> => {
    return this.startCheck({ autoDownload: false });
  };

  downloadUpdate = async (): Promise<UpdateSnapshot> => {
    return this.startDownload();
  };

  applyDownloadedUpdate = async (): Promise<UpdateSnapshot> => {
    if (this.activeTask) {
      return this.snapshot;
    }

    this.setSnapshot({
      ...this.snapshot,
      status: "applying",
      progress: null,
      errorMessage: null
    });
    try {
      const snapshot = this.createManager().applyDownloadedUpdate();
      this.setSnapshot(
        this.deps.applyRestartMode === "managed-service-restart"
          ? snapshot
          : {
              ...snapshot,
              recoveryCommand: "Restart this NextClaw process to launch the downloaded runtime."
            },
      );
      if (this.deps.applyRestartMode === "managed-service-restart") {
        await requestManagedServiceRestart(this.deps.requestRestart, {
          reason: "runtime update apply",
          uiPort: this.deps.uiConfig.port
        });
      }
      return this.snapshot;
    } catch (error) {
      this.setSnapshot(this.toFailedSnapshot(error));
      throw error;
    }
  };

  updatePreferences = async (preferences: Partial<UpdatePreferences>): Promise<UpdateSnapshot> => {
    const nextState = this.stateStore.update((current) => ({
      ...current,
      updatePreferences: {
        ...current.updatePreferences,
        ...preferences
      }
    }));
    this.setSnapshot(this.createManager(nextState.channel).getSnapshot());
    if (nextState.updatePreferences.automaticChecks) {
      this.startAutomaticSync({ force: true });
    }
    return this.snapshot;
  };

  updateChannel = async (channel: UpdateSnapshot["channel"]): Promise<UpdateSnapshot> => {
    const nextState = this.stateStore.update((current) => ({
      ...current,
      channel
    }));
    this.setSnapshot(this.createManager(nextState.channel).getSnapshot());
    if (nextState.updatePreferences.automaticChecks) {
      return this.startCheck({ autoDownload: nextState.updatePreferences.autoDownload });
    }
    return this.snapshot;
  };

  private startAutomaticSync = (options: { force?: boolean } = {}): void => {
    if (this.activeTask) {
      return;
    }
    if (this.automaticSyncStarted && !options.force) {
      return;
    }
    this.automaticSyncStarted = true;
    const state = this.stateStore.read();
    if (!state.updatePreferences.automaticChecks || state.downloadedVersion) {
      return;
    }
    void this.startCheck({ autoDownload: state.updatePreferences.autoDownload });
  };

  private startCheck = async (options: { autoDownload: boolean }): Promise<UpdateSnapshot> => {
    if (this.activeTask) {
      return this.snapshot;
    }

    this.setSnapshot({
      ...this.createManager().getSnapshot(),
      status: "checking",
      progress: null,
      errorMessage: null
    });
    this.activeTask = (async () => {
      try {
        const checkedSnapshot = await this.createManager().checkForUpdate();
        this.setSnapshot(checkedSnapshot);
        if (options.autoDownload && checkedSnapshot.status === "update-available") {
          await this.runDownloadTask();
        }
      } catch (error) {
        this.setSnapshot(this.toFailedSnapshot(error));
      } finally {
        this.activeTask = null;
      }
    })();
    return this.snapshot;
  };

  private startDownload = async (): Promise<UpdateSnapshot> => {
    if (this.activeTask) {
      return this.snapshot;
    }

    this.setSnapshot({
      ...this.createManager().getSnapshot(),
      status: "downloading",
      progress: INITIAL_DOWNLOAD_PROGRESS,
      errorMessage: null
    });
    this.activeTask = (async () => {
      try {
        await this.runDownloadTask();
      } catch (error) {
        this.setSnapshot(this.toFailedSnapshot(error));
      } finally {
        this.activeTask = null;
      }
    })();
    return this.snapshot;
  };

  private runDownloadTask = async (): Promise<void> => {
    const downloadedSnapshot = await this.createManager().downloadUpdate((progress) => {
      this.setSnapshot({
        ...this.snapshot,
        status: "downloading",
        progress,
        errorMessage: null
      });
    });
    this.setSnapshot(downloadedSnapshot);
  };

  private createManager = (channel = this.stateStore.read().channel): NpmRuntimeUpdateManager => {
    return new NpmRuntimeUpdateManager({
      layout: this.layout,
      stateStore: this.stateStore,
      bundleService: this.bundleService,
      updateService: this.updateService,
      resolveManifestUrl: (resolvedChannel) => this.source.resolveManifestUrl(resolvedChannel),
      launcherVersion: this.launcherVersion,
      channel
    });
  };

  private toFailedSnapshot = (error: unknown): UpdateSnapshot => {
    return {
      ...this.createManager().getSnapshot(),
      status: "failed",
      progress: null,
      errorMessage: error instanceof Error ? error.message : String(error ?? "Unknown error")
    };
  };

  private setSnapshot = (snapshot: UpdateSnapshot): UpdateSnapshot => {
    this.snapshot = snapshot;
    nextclaw.eventBus.emit(eventKeys.runtimeUpdateSnapshot, snapshot, {
      source: "backend"
    });
    return snapshot;
  };
}

export function createNpmRuntimeUpdateHost(params: NpmRuntimeUpdateHostDeps): NpmRuntimeUpdateHost {
  return new NpmRuntimeUpdateHost(params);
}

import type { Config } from "@nextclaw/core";
import { getAppLogger, type AppLogger } from "@nextclaw/core";
import {
  eventKeys,
  type EventBus,
  type UpdateFailureStage,
  type UpdatePreferences,
  type UpdateProgress,
  type UpdateSnapshot,
} from "@nextclaw/shared";
import type { UiRuntimeUpdateHost } from "@nextclaw/server";
import { NpmRuntimeBundleLayoutStore } from "@nextclaw-service/stores/npm-runtime-bundle-layout.store.js";
import { NpmRuntimeBundleService } from "@nextclaw-service/services/runtime/npm-runtime-bundle.service.js";
import { RuntimeUpdateManager } from "@nextclaw-service/managers/runtime-update.manager.js";
import { NpmRuntimeUpdateService } from "@nextclaw-service/services/runtime/npm-runtime-update.service.js";
import { NpmRuntimeUpdateSourceService } from "@nextclaw-service/services/runtime/npm-runtime-update-source.service.js";
import { NpmRuntimeUpdateStateStore } from "@nextclaw-service/stores/npm-runtime-update-state.store.js";
import { NextclawDistributionService } from "@nextclaw-service/services/runtime/nextclaw-distribution.service.js";
import { requestManagedServiceRestart } from "@nextclaw-service/services/ui/service-remote-access.service.js";
import type { RequestRestartParams } from "@nextclaw-service/types/cli.types.js";

const INITIAL_DOWNLOAD_PROGRESS: UpdateProgress = {
  downloadedBytes: 0,
  totalBytes: null,
  percent: null
};

type NpmRuntimeUpdateHostDeps = {
  eventBus: EventBus;
  logger?: Pick<AppLogger, "error">;
  requestRestart: (params: RequestRestartParams) => Promise<void>;
  uiConfig: Pick<Config["ui"], "port">;
  applyRestartMode: "managed-service-restart" | "manual-process-restart";
};

export class NpmRuntimeUpdateHost implements UiRuntimeUpdateHost {
  private readonly source: NpmRuntimeUpdateSourceService;
  private readonly layout: NpmRuntimeBundleLayoutStore;
  private readonly launcherVersion: string;
  private readonly stateStore: NpmRuntimeUpdateStateStore;
  private readonly bundleService: NpmRuntimeBundleService;
  private readonly updateService: NpmRuntimeUpdateService;
  private snapshot: UpdateSnapshot;
  private activeTask: Promise<void> | null = null;
  private automaticSyncStarted = false;
  private readonly logger: Pick<AppLogger, "error">;

  constructor(private readonly deps: NpmRuntimeUpdateHostDeps) {
    this.logger = deps.logger ?? getAppLogger("service.runtime-update");
    const distribution = NextclawDistributionService.get();
    this.source = new NpmRuntimeUpdateSourceService({
      packagedPublicKeyPath: distribution.runtimeUpdatePublicKeyPath
    });
    this.layout = new NpmRuntimeBundleLayoutStore();
    this.launcherVersion = distribution.version;
    this.stateStore = new NpmRuntimeUpdateStateStore(this.layout.getStatePath(), {
      defaultChannel: this.source.resolveChannel(undefined, this.launcherVersion)
    });
    this.bundleService = new NpmRuntimeBundleService({
      layout: this.layout,
      stateStore: this.stateStore,
      launcherVersion: this.launcherVersion
    });
    this.updateService = new NpmRuntimeUpdateService({
      layout: this.layout,
      bundleService: this.bundleService,
      launcherVersion: this.launcherVersion,
      bundlePublicKey: this.source.resolveBundlePublicKey() ?? undefined
    });
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
      this.setSnapshot(this.toFailedSnapshot("apply", error));
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
    if (!this.activeTask) {
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
          this.setSnapshot(this.toFailedSnapshot("check", error));
        } finally {
          this.activeTask = null;
        }
      })();
    }
    await this.activeTask;
    return this.snapshot;
  };

  private startDownload = async (): Promise<UpdateSnapshot> => {
    if (!this.activeTask) {
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
          this.setSnapshot(this.toFailedSnapshot("download", error));
        } finally {
          this.activeTask = null;
        }
      })();
    }
    await this.activeTask;
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

  private createManager = (channel = this.stateStore.read().channel): RuntimeUpdateManager => {
    return new RuntimeUpdateManager({
      layout: this.layout,
      stateStore: this.stateStore,
      bundleService: this.bundleService,
      updateService: this.updateService,
      resolveManifestUrl: (resolvedChannel) => this.source.resolveManifestUrl(resolvedChannel),
      launcherVersion: this.launcherVersion,
      channel
    });
  };

  private toFailedSnapshot = (failureStage: UpdateFailureStage, error: unknown): UpdateSnapshot => {
    const errorMessage = this.describeFailure(error);
    this.logger.error("runtime update operation failed", { failureStage, errorMessage }, error);
    return {
      ...this.createManager().getSnapshot(),
      status: "failed",
      progress: null,
      errorMessage,
      failureStage,
      diagnosticCommand: "nextclaw logs path"
    };
  };

  private describeFailure = (error: unknown): string => {
    const messages: string[] = [];
    let cause = error;
    while (cause instanceof Error && messages.length < 4) {
      const message = cause.message.trim();
      if (message && messages.at(-1) !== message) {
        messages.push(message);
      }
      cause = cause.cause;
    }
    if (messages.length === 0) {
      messages.push(String(error ?? "Unknown error"));
    }
    return messages.join(": ");
  };

  private setSnapshot = (snapshot: UpdateSnapshot): UpdateSnapshot => {
    this.snapshot = snapshot;
    this.deps.eventBus.emit(eventKeys.runtimeUpdateSnapshot, snapshot, {
      source: "backend"
    });
    return snapshot;
  };
}

import type { DesktopUpdateManifest } from "../utils/update-manifest.utils";
import type { DesktopLauncherStateStore } from "../stores/launcher-state.store";
import type { DesktopReleaseChannel } from "../stores/launcher-state.store";
import type { DesktopAvailableUpdate, DesktopUpdateService } from "./update.service";
import type { DesktopBundleLifecycleService } from "./bundle-lifecycle.service";
import type { DesktopBundleService } from "./bundle.service";
import type { DesktopUpdateSourceService } from "../../services/desktop-update-source.service";
import type {
  UpdateBlockReason,
  UpdatePreferences,
  UpdateProgress,
  UpdateSnapshot,
  UpdateStatus
} from "@nextclaw/kernel";

export type DesktopUpdateStatus = Extract<
  UpdateStatus,
  "idle" | "checking" | "update-available" | "downloading" | "downloaded" | "up-to-date" | "blocked" | "failed"
>;

export type DesktopUpdatePreferences = UpdatePreferences;

export type DesktopUpdateSnapshot = UpdateSnapshot & {
  status: DesktopUpdateStatus;
  channel: DesktopReleaseChannel;
  launcherVersion: string;
  preferences: DesktopUpdatePreferences;
};

type DesktopUpdateCoordinatorServiceOptions = {
  launcherVersion: string;
  updateCapability?: DesktopUpdateCapability;
  bundleManager: DesktopUpdateBundleOwner;
  updateSourceService: DesktopUpdateSourceService;
  now?: () => number;
  publishSnapshot?: (snapshot: DesktopUpdateSnapshot) => void;
  onAutoDownloadedUpdateReady?: (snapshot: DesktopUpdateSnapshot) => void;
};

type DesktopUpdateBundleOwner = {
  launcherStateStore: DesktopLauncherStateStore;
  updateService: DesktopUpdateService;
  bundleLifecycle: DesktopBundleLifecycleService;
  bundleService: DesktopBundleService;
};

type DesktopCheckUpdateOptions = {
  manual?: boolean;
  allowAutoDownload?: boolean;
};

type DesktopDownloadUpdateOptions = {
  autoTriggered?: boolean;
};

export type DesktopUpdateCapability = {
  supported: boolean;
  blockReason: UpdateBlockReason | null;
  message: string | null;
};

type PersistedDesktopLauncherState = ReturnType<DesktopLauncherStateStore["read"]>;
type DesktopUpdateSnapshotPatch = Partial<DesktopUpdateSnapshot> & Pick<DesktopUpdateSnapshot, "status">;

const DEFAULT_STATUS: DesktopUpdateStatus = "idle";
const AUTOMATIC_UPDATE_MINIMUM_CHECK_INTERVAL_MS = 5 * 60 * 60 * 1000;

export class DesktopUpdateCoordinatorService {
  private snapshot: DesktopUpdateSnapshot;
  private availableManifest: DesktopUpdateManifest | null = null;
  private activeCheckPromise: Promise<DesktopUpdateSnapshot> | null = null;
  private activeDownloadPromise: Promise<DesktopUpdateSnapshot> | null = null;

  constructor(private readonly options: DesktopUpdateCoordinatorServiceOptions) {
    const persistedState = this.stateStore.read();
    const updateCapability = this.resolveUpdateCapability();
    this.snapshot = {
      status: updateCapability.supported ? (persistedState.downloadedVersion ? "downloaded" : DEFAULT_STATUS) : "blocked",
      installationKind: "desktop-bundle",
      channel: this.options.updateSourceService.resolveChannel(),
      hostVersion: options.launcherVersion,
      launcherVersion: options.launcherVersion,
      currentVersion: persistedState.currentVersion,
      availableVersion: null,
      downloadedVersion: persistedState.downloadedVersion,
      minimumHostVersion: null,
      releaseNotesUrl: persistedState.downloadedReleaseNotesUrl,
      lastCheckedAt: persistedState.lastUpdateCheckAt,
      progress: null,
      canAutoDownload: updateCapability.supported && persistedState.updatePreferences.autoDownload,
      canApplyInApp: updateCapability.supported && Boolean(persistedState.downloadedVersion),
      requiresRestart: updateCapability.supported && Boolean(persistedState.downloadedVersion),
      blockReason: updateCapability.supported ? null : updateCapability.blockReason,
      recoveryCommand: null,
      errorMessage: updateCapability.supported ? null : updateCapability.message,
      preferences: { ...persistedState.updatePreferences }
    };
    if (updateCapability.supported) {
      this.reconcilePersistedDownloadedState();
    }
    this.publishSnapshot();
  }

  getSnapshot = (): DesktopUpdateSnapshot => {
    return {
      ...this.snapshot,
      preferences: { ...this.snapshot.preferences }
    };
  };

  runAutomaticCheck = async (): Promise<DesktopUpdateSnapshot> => {
    if (this.isUpdateUnsupported()) {
      return this.getSnapshot();
    }
    if (!this.snapshot.preferences.automaticChecks) {
      return this.getSnapshot();
    }
    const lastCheckedAt = Date.parse(this.snapshot.lastCheckedAt ?? "");
    const elapsedSinceLastCheck = (this.options.now?.() ?? Date.now()) - lastCheckedAt;
    const checkedRecently = Number.isFinite(lastCheckedAt) &&
      elapsedSinceLastCheck >= 0 && elapsedSinceLastCheck < AUTOMATIC_UPDATE_MINIMUM_CHECK_INTERVAL_MS;
    if (checkedRecently) {
      return this.getSnapshot();
    }
    return await this.checkForUpdates();
  };

  checkForUpdates = async (options: DesktopCheckUpdateOptions = {}): Promise<DesktopUpdateSnapshot> => {
    if (this.isUpdateUnsupported()) {
      return this.getSnapshot();
    }
    if (this.activeCheckPromise) {
      return await this.activeCheckPromise;
    }

    this.activeCheckPromise = this.performCheckForUpdates(options);
    try {
      return await this.activeCheckPromise;
    } finally {
      this.activeCheckPromise = null;
    }
  };

  downloadUpdate = async (options: DesktopDownloadUpdateOptions = {}): Promise<DesktopUpdateSnapshot> => {
    if (this.isUpdateUnsupported()) {
      return this.getSnapshot();
    }
    if (this.activeDownloadPromise) {
      return await this.activeDownloadPromise;
    }

    this.activeDownloadPromise = this.performDownloadUpdate(options);
    try {
      return await this.activeDownloadPromise;
    } finally {
      this.activeDownloadPromise = null;
    }
  };

  applyDownloadedUpdate = async (): Promise<DesktopUpdateSnapshot> => {
    if (this.isUpdateUnsupported()) {
      return this.getSnapshot();
    }
    const downloadedVersion = this.snapshot.downloadedVersion?.trim();
    if (!downloadedVersion) {
      throw new Error("No downloaded desktop update is ready to apply.");
    }

    this.bundleManager.bundleService.resolveVersion(downloadedVersion);
    await this.bundleManager.bundleLifecycle.activateVersion(downloadedVersion);
    const nextState = this.stateStore.read();
    this.availableManifest = null;
    this.snapshot = this.toSnapshotFromState(nextState, {
      status: "idle",
      availableVersion: null,
      downloadedVersion: null,
      releaseNotesUrl: null,
      canApplyInApp: false,
      requiresRestart: false,
    });
    this.publishSnapshot();
    return this.getSnapshot();
  };

  updatePreferences = async (preferences: Partial<DesktopUpdatePreferences>): Promise<DesktopUpdateSnapshot> => {
    if (this.isUpdateUnsupported()) {
      return this.getSnapshot();
    }
    const nextState = await this.stateStore.update((state) => ({
      ...state,
      updatePreferences: {
        automaticChecks:
          typeof preferences.automaticChecks === "boolean"
            ? preferences.automaticChecks
            : state.updatePreferences.automaticChecks,
        autoDownload:
          typeof preferences.autoDownload === "boolean"
            ? preferences.autoDownload
            : state.updatePreferences.autoDownload
      }
    }));
    this.snapshot = {
      ...this.snapshot,
      preferences: { ...nextState.updatePreferences }
    };
    this.publishSnapshot();
    return this.getSnapshot();
  };

  updateChannel = async (channel: DesktopReleaseChannel): Promise<DesktopUpdateSnapshot> => {
    if (this.isUpdateUnsupported()) {
      return this.getSnapshot();
    }
    if (this.snapshot.channel === channel) {
      return this.getSnapshot();
    }

    const nextState = await this.stateStore.update((state) => ({
      ...state,
      channel,
      downloadedVersion: null,
      downloadedReleaseNotesUrl: null
    }));
    this.availableManifest = null;
    this.snapshot = this.toSnapshotFromState(nextState, {
      status: DEFAULT_STATUS,
      channel: nextState.channel,
      availableVersion: null,
      downloadedVersion: null,
      releaseNotesUrl: null,
      canApplyInApp: false,
      requiresRestart: false,
    });
    this.publishSnapshot();
    return await this.checkForUpdates({
      allowAutoDownload: false
    });
  };

  private performCheckForUpdates = async (options: DesktopCheckUpdateOptions): Promise<DesktopUpdateSnapshot> => {
    const checkedAt = new Date(this.options.now?.() ?? Date.now()).toISOString();

    this.snapshot = {
      ...this.snapshot,
      status: "checking",
      progress: null,
      blockReason: null,
      recoveryCommand: null,
      errorMessage: null
    };
    this.publishSnapshot();

    try {
      const manifestUrl = (await this.options.updateSourceService.resolveManifestUrl())?.trim();
      if (!manifestUrl) {
        throw new Error("Desktop update manifest URL is not configured.");
      }
      const availableUpdate = await this.bundleManager.updateService.checkForUpdate(manifestUrl, this.snapshot.currentVersion);
      const persistedState = await this.recordLastCheckedAt(checkedAt);
      this.snapshot = this.toSnapshotAfterCheck(availableUpdate, persistedState);
      this.publishSnapshot();

      if (
        availableUpdate?.kind === "bundle-update" &&
        this.snapshot.preferences.autoDownload &&
        options.allowAutoDownload !== false
      ) {
        return await this.downloadUpdate({ autoTriggered: true });
      }

      return this.getSnapshot();
    } catch (error) {
      this.availableManifest = null;
      const persistedState = await this.recordLastCheckedAt(checkedAt);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const preservedStatus = persistedState.downloadedVersion ? "downloaded" : DEFAULT_STATUS;
      this.snapshot = this.toSnapshotFromState(persistedState, {
        status: preservedStatus,
      });
      this.publishSnapshot();
      if (options.manual) {
        throw error instanceof Error ? error : new Error(errorMessage);
      }
      return this.getSnapshot();
    }
  };

  private performDownloadUpdate = async (
    options: DesktopDownloadUpdateOptions
  ): Promise<DesktopUpdateSnapshot> => {
    const manifest = await this.ensureAvailableManifest();
    this.snapshot = {
      ...this.snapshot,
      status: "downloading",
      progress: this.createProgress(0, null),
      canApplyInApp: false,
      requiresRestart: false,
      blockReason: null,
      recoveryCommand: null,
      errorMessage: null
    };
    this.publishSnapshot();

    try {
      const downloadedUpdate = await this.bundleManager.updateService.downloadAndInstallUpdate(manifest, (progress) => {
        this.publishDownloadProgress(progress);
      });
      const nextState = await this.stateStore.update((state) => ({
        ...state,
        downloadedVersion: downloadedUpdate.downloadedVersion,
        downloadedReleaseNotesUrl: downloadedUpdate.manifest.releaseNotesUrl
      }));
      await this.bundleManager.bundleService.pruneRetainedArtifacts();
      this.snapshot = this.toSnapshotFromState(nextState, {
        status: "downloaded",
        availableVersion: downloadedUpdate.downloadedVersion,
        downloadedVersion: downloadedUpdate.downloadedVersion,
        minimumHostVersion: downloadedUpdate.manifest.minimumLauncherVersion,
        releaseNotesUrl: downloadedUpdate.manifest.releaseNotesUrl,
        canApplyInApp: true,
        requiresRestart: true,
      });
      this.publishSnapshot();
      if (options.autoTriggered) {
        this.options.onAutoDownloadedUpdateReady?.(this.getSnapshot());
      }
      return this.getSnapshot();
    } catch (error) {
      const persistedState = this.stateStore.read();
      this.snapshot = this.toSnapshotFromState(persistedState, {
        status: persistedState.downloadedVersion ? "downloaded" : "failed",
        minimumHostVersion: manifest.minimumLauncherVersion,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      this.publishSnapshot();
      return this.getSnapshot();
    }
  };

  private ensureAvailableManifest = async (): Promise<DesktopUpdateManifest> => {
    if (this.availableManifest) {
      return this.availableManifest;
    }

    const snapshot = await this.checkForUpdates({ manual: true });
    if (!this.availableManifest) {
      if (snapshot.downloadedVersion) {
        throw new Error(`Version ${snapshot.downloadedVersion} has already been downloaded and is ready to apply.`);
      }
      throw new Error("No desktop update is currently available.");
    }
    return this.availableManifest;
  };

  private toSnapshotAfterCheck = (
    availableUpdate: DesktopAvailableUpdate | null,
    persistedState: PersistedDesktopLauncherState
  ): DesktopUpdateSnapshot => {
    if (persistedState.downloadedVersion) {
      this.availableManifest =
        availableUpdate?.kind === "bundle-update" ? availableUpdate.manifest : this.availableManifest;
      return this.toSnapshotFromState(persistedState, {
        status: "downloaded",
        availableVersion:
          availableUpdate?.kind === "bundle-update" ? availableUpdate.manifest.latestVersion : persistedState.downloadedVersion,
        minimumHostVersion:
          availableUpdate?.kind === "bundle-update" ? availableUpdate.manifest.minimumLauncherVersion : null,
        canApplyInApp: true,
        requiresRestart: true,
      });
    }

    if (!availableUpdate) {
      this.availableManifest = null;
      return this.toSnapshotFromState(persistedState, {
        status: "up-to-date",
        availableVersion: null,
        downloadedVersion: null,
        releaseNotesUrl: null,
        canApplyInApp: false,
        requiresRestart: false,
      });
    }

    if (availableUpdate.kind === "launcher-update-required") {
      this.availableManifest = null;
      return this.toSnapshotFromState(persistedState, {
        status: "blocked",
        availableVersion: availableUpdate.manifest.latestVersion,
        downloadedVersion: null,
        minimumHostVersion: availableUpdate.manifest.minimumLauncherVersion,
        releaseNotesUrl: availableUpdate.manifest.releaseNotesUrl,
        canApplyInApp: false,
        requiresRestart: false,
        blockReason: "host-too-old",
        errorMessage: `Desktop launcher ${this.options.launcherVersion} is too old for bundle ${availableUpdate.manifest.latestVersion}.`,
      });
    }

    if (availableUpdate.kind === "quarantined-bad-version") {
      this.availableManifest = null;
      return this.toSnapshotFromState(persistedState, {
        status: "failed",
        availableVersion: availableUpdate.manifest.latestVersion,
        downloadedVersion: null,
        minimumHostVersion: availableUpdate.manifest.minimumLauncherVersion,
        releaseNotesUrl: availableUpdate.manifest.releaseNotesUrl,
        canApplyInApp: false,
        requiresRestart: false,
        errorMessage: `Version ${availableUpdate.manifest.latestVersion} was quarantined after a failed launch.`,
      });
    }

    this.availableManifest = availableUpdate.manifest;
    return this.toSnapshotFromState(persistedState, {
      status: "update-available",
      availableVersion: availableUpdate.manifest.latestVersion,
      downloadedVersion: null,
      minimumHostVersion: availableUpdate.manifest.minimumLauncherVersion,
      releaseNotesUrl: availableUpdate.manifest.releaseNotesUrl,
      canApplyInApp: false,
      requiresRestart: false,
    });
  };

  private recordLastCheckedAt = async (
    checkedAt: string
  ): Promise<PersistedDesktopLauncherState> => {
    return await this.stateStore.update((state) => ({
      ...state,
      lastUpdateCheckAt: checkedAt
    }));
  };

  private toSnapshotFromState = (
    state: PersistedDesktopLauncherState,
    patch: DesktopUpdateSnapshotPatch
  ): DesktopUpdateSnapshot => {
    const hasDownloadedVersion = Boolean(state.downloadedVersion);
    return {
      ...this.snapshot,
      hostVersion: this.options.launcherVersion,
      currentVersion: state.currentVersion,
      availableVersion: this.snapshot.availableVersion,
      downloadedVersion: state.downloadedVersion,
      minimumHostVersion: null,
      releaseNotesUrl: state.downloadedReleaseNotesUrl,
      lastCheckedAt: state.lastUpdateCheckAt,
      progress: null,
      canAutoDownload: state.updatePreferences.autoDownload,
      canApplyInApp: hasDownloadedVersion,
      requiresRestart: hasDownloadedVersion,
      blockReason: null,
      recoveryCommand: null,
      errorMessage: null,
      preferences: { ...state.updatePreferences },
      ...patch
    };
  };

  private reconcilePersistedDownloadedState = (): void => {
    const persistedState = this.stateStore.read();
    const downloadedVersion = persistedState.downloadedVersion?.trim();
    if (!downloadedVersion) {
      return;
    }

    try {
      this.bundleManager.bundleService.resolveVersion(downloadedVersion);
    } catch {
      void this.stateStore.update((state) => ({
        ...state,
        downloadedVersion: null,
        downloadedReleaseNotesUrl: null
      }));
      this.snapshot = {
        ...this.snapshot,
        downloadedVersion: null,
        releaseNotesUrl: null,
        progress: null,
        canApplyInApp: false,
        requiresRestart: false,
        status: DEFAULT_STATUS
      };
    }
  };

  private publishDownloadProgress = (progress: UpdateProgress): void => {
    this.snapshot = {
      ...this.snapshot,
      status: "downloading",
      progress,
      canApplyInApp: false,
      requiresRestart: false
    };
    this.publishSnapshot();
  };

  private createProgress = (downloadedBytes: number, totalBytes: number | null): UpdateProgress => {
    return {
      downloadedBytes,
      totalBytes,
      percent: totalBytes && totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : null
    };
  };

  private publishSnapshot = (): void => {
    this.options.publishSnapshot?.(this.getSnapshot());
  };

  private get bundleManager(): DesktopUpdateBundleOwner {
    return this.options.bundleManager;
  }

  private get stateStore(): DesktopLauncherStateStore {
    return this.options.bundleManager.launcherStateStore;
  }

  private resolveUpdateCapability = (): DesktopUpdateCapability => {
    return this.options.updateCapability ?? {
      supported: true,
      blockReason: null,
      message: null
    };
  };

  private isUpdateUnsupported = (): boolean => !this.resolveUpdateCapability().supported;
}

import type { DesktopUpdateManifest } from "../utils/update-manifest.utils";
import type { DesktopLauncherStateStore } from "../stores/launcher-state.store";
import type { DesktopReleaseChannel } from "../stores/launcher-state.store";
import type { DesktopAvailableUpdate, DesktopUpdateService } from "./update.service";
import type { DesktopBundleLifecycleService } from "./bundle-lifecycle.service";
import type { DesktopBundleService } from "./bundle.service";

export type DesktopUpdateStatus =
  | "idle"
  | "checking"
  | "update-available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "failed";

export type DesktopUpdatePreferences = {
  automaticChecks: boolean;
  autoDownload: boolean;
};

export type DesktopUpdateSnapshot = {
  status: DesktopUpdateStatus;
  channel: DesktopReleaseChannel;
  launcherVersion: string;
  currentVersion: string | null;
  availableVersion: string | null;
  downloadedVersion: string | null;
  releaseNotesUrl: string | null;
  lastCheckedAt: string | null;
  errorMessage: string | null;
  preferences: DesktopUpdatePreferences;
};

type DesktopUpdateCoordinatorServiceOptions = {
  initialChannel: DesktopReleaseChannel;
  launcherVersion: string;
  resolveManifestUrl: () => Promise<string | null>;
  stateStore: DesktopLauncherStateStore;
  updateService: DesktopUpdateService;
  bundleLifecycle: DesktopBundleLifecycleService;
  bundleService: DesktopBundleService;
  publishSnapshot?: (snapshot: DesktopUpdateSnapshot) => void;
  onAutoDownloadedUpdateReady?: (snapshot: DesktopUpdateSnapshot) => void;
};

type DesktopCheckUpdateOptions = {
  manual?: boolean;
  allowAutoDownload?: boolean;
};

type DesktopDownloadUpdateOptions = {
  autoTriggered?: boolean;
};

const DEFAULT_STATUS: DesktopUpdateStatus = "idle";

export class DesktopUpdateCoordinatorService {
  private snapshot: DesktopUpdateSnapshot;
  private availableManifest: DesktopUpdateManifest | null = null;
  private activeCheckPromise: Promise<DesktopUpdateSnapshot> | null = null;
  private activeDownloadPromise: Promise<DesktopUpdateSnapshot> | null = null;

  constructor(private readonly options: DesktopUpdateCoordinatorServiceOptions) {
    const persistedState = options.stateStore.read();
    this.snapshot = {
      status: persistedState.downloadedVersion ? "downloaded" : DEFAULT_STATUS,
      channel: options.initialChannel,
      launcherVersion: options.launcherVersion,
      currentVersion: persistedState.currentVersion,
      availableVersion: null,
      downloadedVersion: persistedState.downloadedVersion,
      releaseNotesUrl: persistedState.downloadedReleaseNotesUrl,
      lastCheckedAt: persistedState.lastUpdateCheckAt,
      errorMessage: null,
      preferences: { ...persistedState.updatePreferences }
    };
    this.reconcilePersistedDownloadedState();
    this.publishSnapshot();
  }

  getSnapshot = (): DesktopUpdateSnapshot => {
    return {
      ...this.snapshot,
      preferences: { ...this.snapshot.preferences }
    };
  };

  runStartupCheck = async (): Promise<DesktopUpdateSnapshot> => {
    if (!this.snapshot.preferences.automaticChecks) {
      return this.getSnapshot();
    }
    return await this.checkForUpdates();
  };

  checkForUpdates = async (options: DesktopCheckUpdateOptions = {}): Promise<DesktopUpdateSnapshot> => {
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
    const downloadedVersion = this.snapshot.downloadedVersion?.trim();
    if (!downloadedVersion) {
      throw new Error("No downloaded desktop update is ready to apply.");
    }

    this.options.bundleService.resolveVersion(downloadedVersion);
    await this.options.bundleLifecycle.activateVersion(downloadedVersion);
    const nextState = this.options.stateStore.read();
    this.availableManifest = null;
    this.snapshot = {
      ...this.snapshot,
      status: "idle",
      currentVersion: nextState.currentVersion,
      availableVersion: null,
      downloadedVersion: null,
      releaseNotesUrl: null,
      errorMessage: null,
      lastCheckedAt: nextState.lastUpdateCheckAt,
      preferences: { ...nextState.updatePreferences }
    };
    this.publishSnapshot();
    return this.getSnapshot();
  };

  updatePreferences = async (preferences: Partial<DesktopUpdatePreferences>): Promise<DesktopUpdateSnapshot> => {
    const nextState = await this.options.stateStore.update((state) => ({
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
    if (this.snapshot.channel === channel) {
      return this.getSnapshot();
    }

    const nextState = await this.options.stateStore.update((state) => ({
      ...state,
      channel,
      downloadedVersion: null,
      downloadedReleaseNotesUrl: null
    }));
    this.availableManifest = null;
    this.snapshot = {
      ...this.snapshot,
      status: DEFAULT_STATUS,
      channel: nextState.channel,
      currentVersion: nextState.currentVersion,
      availableVersion: null,
      downloadedVersion: null,
      releaseNotesUrl: null,
      lastCheckedAt: nextState.lastUpdateCheckAt,
      errorMessage: null,
      preferences: { ...nextState.updatePreferences }
    };
    this.publishSnapshot();
    return await this.checkForUpdates({
      allowAutoDownload: false
    });
  };

  private performCheckForUpdates = async (options: DesktopCheckUpdateOptions): Promise<DesktopUpdateSnapshot> => {
    const checkedAt = new Date().toISOString();

    this.snapshot = {
      ...this.snapshot,
      status: "checking",
      errorMessage: null
    };
    this.publishSnapshot();

    try {
      const manifestUrl = (await this.options.resolveManifestUrl())?.trim();
      if (!manifestUrl) {
        throw new Error("Desktop update manifest URL is not configured.");
      }
      const availableUpdate = await this.options.updateService.checkForUpdate(manifestUrl, this.snapshot.currentVersion);
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
      this.snapshot = {
        ...this.snapshot,
        status: preservedStatus,
        currentVersion: persistedState.currentVersion,
        downloadedVersion: persistedState.downloadedVersion,
        releaseNotesUrl: persistedState.downloadedReleaseNotesUrl,
        lastCheckedAt: persistedState.lastUpdateCheckAt,
        errorMessage: null,
        preferences: { ...persistedState.updatePreferences }
      };
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
      errorMessage: null
    };
    this.publishSnapshot();

    try {
      const downloadedUpdate = await this.options.updateService.downloadAndInstallUpdate(manifest);
      const nextState = await this.options.stateStore.update((state) => ({
        ...state,
        downloadedVersion: downloadedUpdate.downloadedVersion,
        downloadedReleaseNotesUrl: downloadedUpdate.manifest.releaseNotesUrl
      }));
      await this.options.bundleService.pruneRetainedArtifacts();
      this.snapshot = {
        ...this.snapshot,
        status: "downloaded",
        currentVersion: nextState.currentVersion,
        availableVersion: downloadedUpdate.downloadedVersion,
        downloadedVersion: downloadedUpdate.downloadedVersion,
        releaseNotesUrl: downloadedUpdate.manifest.releaseNotesUrl,
        lastCheckedAt: nextState.lastUpdateCheckAt,
        errorMessage: null,
        preferences: { ...nextState.updatePreferences }
      };
      this.publishSnapshot();
      if (options.autoTriggered) {
        this.options.onAutoDownloadedUpdateReady?.(this.getSnapshot());
      }
      return this.getSnapshot();
    } catch (error) {
      const persistedState = this.options.stateStore.read();
      this.snapshot = {
        ...this.snapshot,
        status: persistedState.downloadedVersion ? "downloaded" : "failed",
        currentVersion: persistedState.currentVersion,
        downloadedVersion: persistedState.downloadedVersion,
        releaseNotesUrl: persistedState.downloadedReleaseNotesUrl,
        lastCheckedAt: persistedState.lastUpdateCheckAt,
        errorMessage: error instanceof Error ? error.message : String(error),
        preferences: { ...persistedState.updatePreferences }
      };
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
    persistedState: ReturnType<DesktopLauncherStateStore["read"]>
  ): DesktopUpdateSnapshot => {
    if (persistedState.downloadedVersion) {
      this.availableManifest =
        availableUpdate?.kind === "bundle-update" ? availableUpdate.manifest : this.availableManifest;
      return {
        ...this.snapshot,
        status: "downloaded",
        currentVersion: persistedState.currentVersion,
        availableVersion:
          availableUpdate?.kind === "bundle-update" ? availableUpdate.manifest.latestVersion : persistedState.downloadedVersion,
        downloadedVersion: persistedState.downloadedVersion,
        releaseNotesUrl: persistedState.downloadedReleaseNotesUrl,
        lastCheckedAt: persistedState.lastUpdateCheckAt,
        errorMessage: null,
        preferences: { ...persistedState.updatePreferences }
      };
    }

    if (!availableUpdate) {
      this.availableManifest = null;
      return {
        ...this.snapshot,
        status: "up-to-date",
        currentVersion: persistedState.currentVersion,
        availableVersion: null,
        downloadedVersion: null,
        releaseNotesUrl: null,
        lastCheckedAt: persistedState.lastUpdateCheckAt,
        errorMessage: null,
        preferences: { ...persistedState.updatePreferences }
      };
    }

    if (availableUpdate.kind === "launcher-update-required") {
      this.availableManifest = null;
      return {
        ...this.snapshot,
        status: "failed",
        currentVersion: persistedState.currentVersion,
        availableVersion: availableUpdate.manifest.latestVersion,
        downloadedVersion: null,
        releaseNotesUrl: availableUpdate.manifest.releaseNotesUrl,
        lastCheckedAt: persistedState.lastUpdateCheckAt,
        errorMessage: `Desktop launcher ${this.options.launcherVersion} is too old for bundle ${availableUpdate.manifest.latestVersion}.`,
        preferences: { ...persistedState.updatePreferences }
      };
    }

    if (availableUpdate.kind === "quarantined-bad-version") {
      this.availableManifest = null;
      return {
        ...this.snapshot,
        status: "failed",
        currentVersion: persistedState.currentVersion,
        availableVersion: availableUpdate.manifest.latestVersion,
        downloadedVersion: null,
        releaseNotesUrl: availableUpdate.manifest.releaseNotesUrl,
        lastCheckedAt: persistedState.lastUpdateCheckAt,
        errorMessage: `Version ${availableUpdate.manifest.latestVersion} was quarantined after a failed launch.`,
        preferences: { ...persistedState.updatePreferences }
      };
    }

    this.availableManifest = availableUpdate.manifest;
    return {
      ...this.snapshot,
      status: "update-available",
      currentVersion: persistedState.currentVersion,
      availableVersion: availableUpdate.manifest.latestVersion,
      downloadedVersion: null,
      releaseNotesUrl: availableUpdate.manifest.releaseNotesUrl,
      lastCheckedAt: persistedState.lastUpdateCheckAt,
      errorMessage: null,
      preferences: { ...persistedState.updatePreferences }
    };
  };

  private recordLastCheckedAt = async (
    checkedAt: string
  ): Promise<ReturnType<DesktopLauncherStateStore["read"]>> => {
    return await this.options.stateStore.update((state) => ({
      ...state,
      lastUpdateCheckAt: checkedAt
    }));
  };

  private reconcilePersistedDownloadedState = (): void => {
    const persistedState = this.options.stateStore.read();
    const downloadedVersion = persistedState.downloadedVersion?.trim();
    if (!downloadedVersion) {
      return;
    }

    try {
      this.options.bundleService.resolveVersion(downloadedVersion);
    } catch {
      void this.options.stateStore.update((state) => ({
        ...state,
        downloadedVersion: null,
        downloadedReleaseNotesUrl: null
      }));
      this.snapshot = {
        ...this.snapshot,
        downloadedVersion: null,
        releaseNotesUrl: null,
        status: DEFAULT_STATUS
      };
    }
  };

  private publishSnapshot = (): void => {
    this.options.publishSnapshot?.(this.getSnapshot());
  };
}

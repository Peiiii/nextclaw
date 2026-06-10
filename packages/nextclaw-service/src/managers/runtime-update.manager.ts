import type { UpdateManifest, UpdateProgress, UpdateSnapshot } from "@nextclaw/kernel";
import { getPackageVersion } from "@nextclaw-service/utils/cli.utils.js";
import { resolveEffectiveNpmRuntimeVersion } from "@nextclaw-service/services/runtime/npm-runtime-bundle.service.js";
import type { NpmRuntimeBundleService } from "@nextclaw-service/services/runtime/npm-runtime-bundle.service.js";
import type { NpmRuntimeBundleLayoutStore } from "@nextclaw-service/stores/npm-runtime-bundle-layout.store.js";
import type { NpmRuntimeUpdateService, NpmRuntimeAvailableUpdate } from "@nextclaw-service/services/runtime/npm-runtime-update.service.js";
import type { NpmRuntimeUpdateStateStore } from "@nextclaw-service/stores/npm-runtime-update-state.store.js";
import type { NpmRuntimeReleaseChannel } from "@nextclaw-service/services/runtime/npm-runtime-update-source.service.js";
import type { NpmRuntimeUpdateState } from "@nextclaw-service/types/npm-runtime-bundle.types.js";

type RuntimeUpdateManagerOptions = {
  layout: NpmRuntimeBundleLayoutStore;
  stateStore: NpmRuntimeUpdateStateStore;
  bundleService: NpmRuntimeBundleService;
  updateService: NpmRuntimeUpdateService;
  resolveManifestUrl: (channel: NpmRuntimeReleaseChannel) => string | null;
  launcherVersion?: string;
  channel: NpmRuntimeReleaseChannel;
  now?: () => Date;
};

type NpmRuntimeUpdateActionOptions = {
  apply?: boolean;
  applyAfterDownload?: boolean;
  checkOnly?: boolean;
  onProgress?: (progress: UpdateProgress) => void;
};

export class RuntimeUpdateManager {
  private readonly launcherVersion: string;
  private readonly now: () => Date;
  private availableManifest: UpdateManifest | null = null;

  constructor(private readonly options: RuntimeUpdateManagerOptions) {
    this.launcherVersion = options.launcherVersion ?? getPackageVersion();
    this.now = options.now ?? (() => new Date());
    this.options.layout.ensureLauncherDirs();
    this.syncStateFromCurrentPointer();
  }

  getSnapshot = (): UpdateSnapshot => this.toSnapshotFromState(this.options.stateStore.read(), {
    status: this.options.stateStore.read().downloadedVersion ? "downloaded" : "idle"
  });

  run = async (options: NpmRuntimeUpdateActionOptions = {}): Promise<UpdateSnapshot> => {
    if (options.apply) {
      return this.applyDownloadedUpdate();
    }

    const applyAfterDownload = options.applyAfterDownload ?? true;
    const checkedSnapshot = await this.checkForUpdate();
    if (options.checkOnly) {
      return checkedSnapshot;
    }
    if (applyAfterDownload && checkedSnapshot.status === "downloaded") {
      return this.applyDownloadedUpdate();
    }
    if (checkedSnapshot.status !== "update-available") {
      return checkedSnapshot;
    }
    const downloadedSnapshot = await this.downloadUpdate(options.onProgress);
    if (!applyAfterDownload || downloadedSnapshot.status !== "downloaded") {
      return downloadedSnapshot;
    }
    return this.applyDownloadedUpdate();
  };

  checkForUpdate = async (): Promise<UpdateSnapshot> => {
    const manifestUrl = this.options.resolveManifestUrl(this.options.channel);
    if (!this.options.updateService.hasSignatureVerifier()) {
      return this.toSnapshotFromState(this.options.stateStore.read(), {
        status: "blocked",
        installationKind: "npm-runtime-bundle",
        blockReason: "signature-verification-unavailable",
        recoveryCommand: "Set NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY or NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY_PATH",
        errorMessage: "Runtime bundle updates require a configured update public key."
      });
    }
    if (!manifestUrl) {
      return this.toSnapshotFromState(this.options.stateStore.read(), {
        status: "blocked",
        installationKind: "npm-runtime-bundle",
        blockReason: "unsupported-installation",
        recoveryCommand: "Set NEXTCLAW_UPDATE_MANIFEST_URL or NEXTCLAW_UPDATE_MANIFEST_BASE_URL",
        errorMessage: "Runtime bundle update manifest URL is not configured."
      });
    }

    const checkedAt = this.now().toISOString();
    const state = this.options.stateStore.update((current) => ({
      ...current,
      channel: this.options.channel,
      lastUpdateCheckAt: checkedAt
    }));
    const availableUpdate = await this.options.updateService.checkForUpdate(manifestUrl, state.currentVersion, state.badVersions);
    return this.toSnapshotAfterCheck(availableUpdate, this.options.stateStore.read());
  };

  downloadUpdate = async (onProgress?: (progress: UpdateProgress) => void): Promise<UpdateSnapshot> => {
    const manifest = this.availableManifest ?? await this.ensureAvailableManifest();
    const downloaded = await this.options.updateService.downloadAndInstallUpdate(manifest, onProgress);
    const state = this.options.stateStore.update((current) => ({
      ...current,
      downloadedVersion: downloaded.downloadedVersion,
      downloadedReleaseNotesUrl: downloaded.manifest.releaseNotesUrl
    }));
    await this.options.bundleService.pruneRetainedArtifacts();
    return this.toSnapshotFromState(state, {
      status: "downloaded",
      availableVersion: downloaded.downloadedVersion,
      downloadedVersion: downloaded.downloadedVersion,
      minimumHostVersion: downloaded.manifest.minimumLauncherVersion,
      releaseNotesUrl: downloaded.manifest.releaseNotesUrl,
      canApplyInApp: true,
      requiresRestart: false
    });
  };

  applyDownloadedUpdate = (): UpdateSnapshot => {
    const downloadedVersion = this.options.stateStore.read().downloadedVersion?.trim();
    if (!downloadedVersion) {
      throw new Error("No downloaded npm runtime update is ready to apply.");
    }
    this.options.bundleService.activateVersion(downloadedVersion);
    this.availableManifest = null;
    return this.toSnapshotFromState(this.options.stateStore.read(), {
      status: "restart-required",
      availableVersion: null,
      downloadedVersion: null,
      releaseNotesUrl: null,
      canApplyInApp: false,
      requiresRestart: true
    });
  };

  private ensureAvailableManifest = async (): Promise<UpdateManifest> => {
    const snapshot = await this.checkForUpdate();
    if (!this.availableManifest) {
      if (snapshot.downloadedVersion) {
        throw new Error(`Version ${snapshot.downloadedVersion} has already been downloaded and is ready to apply.`);
      }
      throw new Error("No npm runtime update is currently available.");
    }
    return this.availableManifest;
  };

  private toSnapshotAfterCheck = (
    availableUpdate: NpmRuntimeAvailableUpdate | null,
    state: NpmRuntimeUpdateState
  ): UpdateSnapshot => {
    if (state.downloadedVersion) {
      this.availableManifest = availableUpdate?.kind === "runtime-bundle-update" ? availableUpdate.manifest : this.availableManifest;
      return this.toSnapshotFromState(state, {
        status: "downloaded",
        availableVersion: availableUpdate?.kind === "runtime-bundle-update" ? availableUpdate.manifest.latestVersion : state.downloadedVersion,
        minimumHostVersion: availableUpdate?.kind === "runtime-bundle-update" ? availableUpdate.manifest.minimumLauncherVersion : null,
        canApplyInApp: true,
        requiresRestart: false
      });
    }
    if (!availableUpdate) {
      this.availableManifest = null;
      return this.toSnapshotFromState(state, {
        status: "up-to-date",
        availableVersion: null,
        downloadedVersion: null,
        releaseNotesUrl: null
      });
    }
    if (availableUpdate.kind === "host-update-required") {
      this.availableManifest = null;
      return this.toSnapshotFromState(state, {
        status: "blocked",
        availableVersion: availableUpdate.manifest.latestVersion,
        minimumHostVersion: availableUpdate.manifest.minimumLauncherVersion,
        releaseNotesUrl: availableUpdate.manifest.releaseNotesUrl,
        blockReason: "host-too-old",
        recoveryCommand: "npm install -g nextclaw@latest",
        errorMessage: `NextClaw npm launcher ${this.launcherVersion} is too old for runtime bundle ${availableUpdate.manifest.latestVersion}.`
      });
    }
    if (availableUpdate.kind === "quarantined-bad-version") {
      this.availableManifest = null;
      return this.toSnapshotFromState(state, {
        status: "failed",
        availableVersion: availableUpdate.manifest.latestVersion,
        minimumHostVersion: availableUpdate.manifest.minimumLauncherVersion,
        releaseNotesUrl: availableUpdate.manifest.releaseNotesUrl,
        errorMessage: `Version ${availableUpdate.manifest.latestVersion} was quarantined after a failed launch.`
      });
    }
    this.availableManifest = availableUpdate.manifest;
    return this.toSnapshotFromState(state, {
      status: "update-available",
      availableVersion: availableUpdate.manifest.latestVersion,
      minimumHostVersion: availableUpdate.manifest.minimumLauncherVersion,
      releaseNotesUrl: availableUpdate.manifest.releaseNotesUrl
    });
  };

  private syncStateFromCurrentPointer = (): void => {
    const currentPointer = this.options.layout.readCurrentPointer();
    const effectiveCurrentVersion = resolveEffectiveNpmRuntimeVersion({
      launcherVersion: this.launcherVersion,
      currentBundleVersion: currentPointer?.version ?? null
    });
    if (!effectiveCurrentVersion) {
      return;
    }
    this.options.stateStore.update((state) => ({
      ...state,
      currentVersion: effectiveCurrentVersion
    }));
  };

  private toSnapshotFromState = (
    state: NpmRuntimeUpdateState,
    patch: Partial<UpdateSnapshot> & Pick<UpdateSnapshot, "status">
  ): UpdateSnapshot => {
    const hasDownloadedVersion = Boolean(state.downloadedVersion);
    const { status } = patch;
    return {
      installationKind: "npm-runtime-bundle",
      channel: state.channel,
      hostVersion: this.launcherVersion,
      currentVersion: state.currentVersion,
      availableVersion: null,
      downloadedVersion: state.downloadedVersion,
      minimumHostVersion: null,
      releaseNotesUrl: state.downloadedReleaseNotesUrl,
      lastCheckedAt: state.lastUpdateCheckAt,
      progress: null,
      canAutoDownload: state.updatePreferences.autoDownload,
      canApplyInApp: hasDownloadedVersion,
      requiresRestart: false,
      blockReason: null,
      recoveryCommand: null,
      errorMessage: null,
      preferences: { ...state.updatePreferences },
      ...patch,
      status
    };
  };
}

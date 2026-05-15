import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { compareDesktopVersions } from "../launcher/utils/version.utils";
import { DesktopBundleLifecycleService } from "../launcher/services/bundle-lifecycle.service";
import { DesktopBundleService } from "../launcher/services/bundle.service";
import { DesktopUpdateService } from "../launcher/services/update.service";
import { DesktopBundleLayoutStore } from "../launcher/stores/bundle-layout.store";
import {
  DesktopLauncherStateStore,
  type DesktopLauncherState,
  type DesktopReleaseChannel
} from "../launcher/stores/launcher-state.store";
import type { PackagedSeedBundleMetadata } from "./desktop-update-source.service";

type DesktopBundleBootstrapLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

type DesktopBundleBootstrapServiceOptions = {
  logger: DesktopBundleBootstrapLogger;
  launcherVersion: string;
  channel: DesktopReleaseChannel;
  resolveManifestUrl: () => Promise<string | null>;
  bundlePublicKey: string | null;
  seedBundlePath: string | null;
  seedBundleMetadata?: PackagedSeedBundleMetadata | null;
  launcherBuildFingerprint?: string | null;
  layout?: DesktopBundleLayoutStore;
};

type PackagedSeedInstallPlan = {
  seedVersion: string;
  currentVersion: string | null;
  seedMetadata: PackagedSeedBundleMetadata | null;
  seedSha256: string | null;
  launcherBuildFingerprint: string | null;
  shouldRetryQuarantinedSeed: boolean;
  shouldInstallSeed: boolean;
  samePackagedSeedAttempt: boolean;
};

export class DesktopBundleBootstrapService {
  constructor(private readonly options: DesktopBundleBootstrapServiceOptions) {}

  ensureInitialBundleAvailability = async (): Promise<void> => {
    const stateStore = this.createLauncherStateStore();
    const state = stateStore.read();
    if (await this.installPackagedSeedBundleIfNeeded(state)) {
      return;
    }

    if (state.currentVersion) {
      return;
    }

    const manifestUrl = (await this.options.resolveManifestUrl())?.trim();
    if (!manifestUrl) {
      return;
    }

    this.options.logger.info("No active product bundle found. Desktop will try to fetch the latest stable bundle before boot.");
    await this.fetchInitialRemoteBundle(manifestUrl);
  };

  recoverPendingBundleCandidate = async (): Promise<void> => {
    const rollbackResult = await this.createBundleLifecycle().recoverPendingCandidate();
    if (!rollbackResult) {
      return;
    }
    if (rollbackResult.rolledBackTo) {
      this.options.logger.warn(
        [
          `Rolled back unconfirmed bundle ${rollbackResult.rolledBackFrom}.`,
          `Launcher restored ${rollbackResult.rolledBackTo} before starting desktop again.`
        ].join(" ")
      );
      return;
    }
    this.options.logger.warn(
      [
        `Cleared unconfirmed bundle ${rollbackResult.rolledBackFrom}.`,
        "No known-good bundle was available for rollback."
      ].join(" ")
    );
  };

  markBundleHealthy = async (version: string): Promise<void> => {
    await this.createBundleLifecycle().markVersionHealthy(version);
    this.options.logger.info(`Bundle version marked healthy: ${version}`);
  };

  pruneRetainedBundleArtifacts = async (): Promise<void> => {
    const pruneResult = await this.createBundleService().pruneRetainedArtifacts();
    if (pruneResult.removedVersions.length === 0 && pruneResult.removedStagingEntries.length === 0) {
      return;
    }
    this.options.logger.info(
      [
        "Pruned desktop bundle storage.",
        `kept=${pruneResult.keptVersions.join(",") || "none"}`,
        `removedVersions=${pruneResult.removedVersions.join(",") || "none"}`,
        `removedStaging=${pruneResult.removedStagingEntries.join(",") || "none"}`
      ].join(" ")
    );
  };

  repairPackagedSeedBundle = async (failedBundleVersion: string): Promise<boolean> => {
    const seedBundlePath = this.options.seedBundlePath?.trim();
    if (!seedBundlePath) {
      return false;
    }

    try {
      const updateService = this.createUpdateService();
      const seedVersion =
        this.options.seedBundleMetadata?.version ?? (await updateService.readLocalArchiveBundleVersion(seedBundlePath));
      if (seedVersion !== failedBundleVersion) {
        return false;
      }
      this.options.logger.warn(
        `Desktop bootstrap failed while running bundle ${failedBundleVersion}. Reinstalling packaged seed bundle ${seedVersion}.`
      );
      await this.createBundleService().removeVersion(seedVersion);
      const repairedBundle = await updateService.stageLocalArchive(seedBundlePath);
      this.options.logger.info(`Reinstalled packaged seed bundle ${repairedBundle.activatedVersion} after bootstrap failure.`);
      return true;
    } catch (error) {
      this.options.logger.warn(`Failed to repair packaged seed bundle after bootstrap failure: ${String(error)}`);
      return false;
    }
  };

  private installPackagedSeedBundleIfNeeded = async (state: DesktopLauncherState): Promise<boolean> => {
    const seedBundlePath = this.options.seedBundlePath?.trim();
    if (!seedBundlePath) {
      return false;
    }

    try {
      const inspectStartedAt = Date.now();
      const updateService = this.createUpdateService();
      const installPlan = await this.createPackagedSeedInstallPlan(state, seedBundlePath, updateService);
      if (!installPlan.shouldInstallSeed) {
        this.logSkippedPackagedSeedInstall(installPlan);
        return false;
      }
      this.logPackagedSeedMetadata(installPlan);
      this.logPackagedSeedInstallPlan(installPlan);
      const installStartedAt = Date.now();
      if (installPlan.shouldRetryQuarantinedSeed) {
        await this.createBundleService().removeVersion(installPlan.seedVersion);
      }
      const stagedSeedBundle = await updateService.stageLocalArchive(seedBundlePath);
      const seedSha256 = await this.resolvePackagedSeedSha256(installPlan, seedBundlePath);
      await this.createLauncherStateStore().update((currentState) => ({
        ...currentState,
        lastAttemptedPackagedSeedVersion: installPlan.seedVersion,
        lastAttemptedPackagedSeedSha256: seedSha256,
        lastAttemptedPackagedSeedLauncherFingerprint: installPlan.launcherBuildFingerprint
      }));
      this.options.logger.info(
        [
          `Prepared packaged seed bundle ${stagedSeedBundle.activatedVersion} for desktop startup.`,
          `inspectMs=${installStartedAt - inspectStartedAt}`,
          `installMs=${Date.now() - installStartedAt}`
        ].join(" ")
      );
      return true;
    } catch (error) {
      this.options.logger.warn(`Failed to inspect or install packaged seed bundle: ${String(error)}`);
      return false;
    }
  };

  private createPackagedSeedInstallPlan = async (
    state: DesktopLauncherState,
    seedBundlePath: string,
    updateService: DesktopUpdateService
  ): Promise<PackagedSeedInstallPlan> => {
    const seedMetadata = this.options.seedBundleMetadata ?? null;
    const launcherBuildFingerprint = this.options.launcherBuildFingerprint?.trim() || null;
    const seedVersion = seedMetadata?.version ?? (await updateService.readLocalArchiveBundleVersion(seedBundlePath));
    const currentVersion = state.currentVersion;
    const quarantined = state.badVersions.includes(seedVersion);
    const shouldUpgrade = !currentVersion || compareDesktopVersions(seedVersion, currentVersion) > 0;
    const samePackagedSeedAttempt = await this.isSamePackagedSeedAttempt(state, seedVersion, seedMetadata, seedBundlePath);
    const shouldRetryQuarantinedSeed = quarantined && !samePackagedSeedAttempt;
    return {
      seedVersion,
      currentVersion,
      seedMetadata,
      seedSha256: samePackagedSeedAttempt ? seedMetadata?.sha256 ?? state.lastAttemptedPackagedSeedSha256 : seedMetadata?.sha256 ?? null,
      launcherBuildFingerprint,
      shouldRetryQuarantinedSeed,
      shouldInstallSeed: (!quarantined && shouldUpgrade) || shouldRetryQuarantinedSeed,
      samePackagedSeedAttempt
    };
  };

  private isSamePackagedSeedAttempt = async (
    state: DesktopLauncherState,
    seedVersion: string,
    seedMetadata: PackagedSeedBundleMetadata | null,
    seedBundlePath: string
  ): Promise<boolean> => {
    if (!state.badVersions.includes(seedVersion) || state.lastAttemptedPackagedSeedVersion !== seedVersion) {
      return false;
    }
    const seedSha256 = seedMetadata?.sha256 ?? (await this.readBundleArchiveSha256(seedBundlePath));
    if (state.lastAttemptedPackagedSeedSha256 !== seedSha256) {
      return false;
    }
    const launcherBuildFingerprint = this.options.launcherBuildFingerprint?.trim() || null;
    return Boolean(launcherBuildFingerprint)
      && state.lastAttemptedPackagedSeedLauncherFingerprint === launcherBuildFingerprint;
  };

  private resolvePackagedSeedSha256 = async (
    installPlan: PackagedSeedInstallPlan,
    seedBundlePath: string
  ): Promise<string> => {
    return installPlan.seedSha256 ?? installPlan.seedMetadata?.sha256 ?? (await this.readBundleArchiveSha256(seedBundlePath));
  };

  private logSkippedPackagedSeedInstall = (installPlan: PackagedSeedInstallPlan): void => {
    if (installPlan.samePackagedSeedAttempt) {
      this.options.logger.warn(
        `Skipping packaged seed bundle ${installPlan.seedVersion} because the same packaged archive and launcher fingerprint already failed on this machine.`
      );
    }
  };

  private logPackagedSeedMetadata = (installPlan: PackagedSeedInstallPlan): void => {
    if (!installPlan.seedMetadata) {
      return;
    }
    this.options.logger.info(
      [
        `Packaged seed metadata loaded for ${installPlan.seedVersion}.`,
        `archiveBytes=${installPlan.seedMetadata.archiveBytes}`,
        `files=${installPlan.seedMetadata.fileCount}`,
        `directories=${installPlan.seedMetadata.directoryCount}`,
        `uncompressedBytes=${installPlan.seedMetadata.uncompressedBytes}`
      ].join(" ")
    );
  };

  private logPackagedSeedInstallPlan = (installPlan: PackagedSeedInstallPlan): void => {
    this.options.logger.info(
      installPlan.shouldRetryQuarantinedSeed
        ? `Packaged seed bundle ${installPlan.seedVersion} was previously quarantined, but the packaged archive fingerprint changed. Desktop will retry it before boot.`
        : !installPlan.currentVersion
          ? "No active product bundle found. Desktop will install the packaged seed bundle before boot."
          : `Packaged seed bundle ${installPlan.seedVersion} is newer than current bundle ${installPlan.currentVersion}. Desktop will upgrade before boot.`
    );
  };

  private readBundleArchiveSha256 = async (archivePath: string): Promise<string> => {
    return createHash("sha256").update(await readFile(archivePath)).digest("hex");
  };

  private fetchInitialRemoteBundle = async (manifestUrl: string): Promise<void> => {
    try {
      const result = await this.createUpdateService().stageUpdate(manifestUrl, null);
      if (!result) {
        this.options.logger.warn("Update manifest returned no bundle for initial desktop bootstrap.");
        return;
      }
      if (result.kind === "launcher-update-required") {
        this.options.logger.warn(
          `Initial bundle bootstrap requires launcher >= ${result.manifest.minimumLauncherVersion}; current launcher is ${this.options.launcherVersion}.`
        );
        return;
      }
      if (result.kind === "quarantined-bad-version") {
        this.options.logger.warn(
          `Initial bundle bootstrap skipped quarantined bad version ${result.manifest.latestVersion}.`
        );
        return;
      }
      this.options.logger.info(`Prepared initial bundle ${result.activatedVersion} for desktop startup.`);
    } catch (error) {
      this.options.logger.warn(`Failed to fetch initial desktop bundle: ${String(error)}`);
    }
  };

  private createBundleLifecycle = (): DesktopBundleLifecycleService => {
    const layout = this.getLayout();
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    return new DesktopBundleLifecycleService({
      layout,
      stateStore,
      bundleService: new DesktopBundleService({
        layout,
        stateStore,
        launcherVersion: this.options.launcherVersion
      })
    });
  };

  private createUpdateService = (): DesktopUpdateService => {
    return new DesktopUpdateService({
      layout: this.getLayout(),
      channel: this.options.channel,
      launcherVersion: this.options.launcherVersion,
      bundlePublicKey: this.options.bundlePublicKey ?? undefined
    });
  };

  private createLauncherStateStore = (): DesktopLauncherStateStore => {
    const layout = this.getLayout();
    return new DesktopLauncherStateStore(layout.getLauncherStatePath());
  };

  private createBundleService = (): DesktopBundleService => {
    const layout = this.getLayout();
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    return new DesktopBundleService({
      layout,
      stateStore,
      launcherVersion: this.options.launcherVersion
    });
  };

  private getLayout = (): DesktopBundleLayoutStore => {
    return this.options.layout ?? new DesktopBundleLayoutStore();
  };
}

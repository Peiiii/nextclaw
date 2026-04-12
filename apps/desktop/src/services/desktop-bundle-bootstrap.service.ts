import { compareDesktopVersions } from "../launcher/utils/version.utils";
import { DesktopBundleLifecycleService } from "../launcher/services/bundle-lifecycle.service";
import { DesktopBundleService } from "../launcher/services/bundle.service";
import { DesktopUpdateService } from "../launcher/services/update.service";
import { DesktopBundleLayoutStore } from "../launcher/stores/bundle-layout.store";
import { DesktopLauncherStateStore } from "../launcher/stores/launcher-state.store";
import type { DesktopReleaseChannel } from "./desktop-update-source.service";

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
};

export class DesktopBundleBootstrapService {
  constructor(private readonly options: DesktopBundleBootstrapServiceOptions) {}

  ensureInitialBundleAvailability = async (): Promise<void> => {
    const stateStore = this.createLauncherStateStore();
    const currentVersion = stateStore.read().currentVersion;
    if (await this.installPackagedSeedBundleIfNeeded(currentVersion)) {
      return;
    }

    if (currentVersion) {
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

  private installPackagedSeedBundleIfNeeded = async (currentVersion: string | null): Promise<boolean> => {
    const seedBundlePath = this.options.seedBundlePath?.trim();
    if (!seedBundlePath) {
      return false;
    }

    try {
      const updateService = this.createUpdateService();
      const seedVersion = await updateService.readLocalArchiveBundleVersion(seedBundlePath);
      const shouldInstallSeed = !currentVersion || compareDesktopVersions(seedVersion, currentVersion) > 0;
      if (!shouldInstallSeed) {
        return false;
      }
      this.options.logger.info(
        !currentVersion
          ? "No active product bundle found. Desktop will install the packaged seed bundle before boot."
          : `Packaged seed bundle ${seedVersion} is newer than current bundle ${currentVersion}. Desktop will upgrade before boot.`
      );
      const stagedSeedBundle = await updateService.stageLocalArchive(seedBundlePath);
      this.options.logger.info(`Prepared packaged seed bundle ${stagedSeedBundle.activatedVersion} for desktop startup.`);
      return true;
    } catch (error) {
      this.options.logger.warn(`Failed to inspect or install packaged seed bundle: ${String(error)}`);
      return false;
    }
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
    const layout = new DesktopBundleLayoutStore();
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
      layout: new DesktopBundleLayoutStore(),
      channel: this.options.channel,
      launcherVersion: this.options.launcherVersion,
      bundlePublicKey: this.options.bundlePublicKey ?? undefined
    });
  };

  private createLauncherStateStore = (): DesktopLauncherStateStore => {
    const layout = new DesktopBundleLayoutStore();
    return new DesktopLauncherStateStore(layout.getLauncherStatePath());
  };

  private createBundleService = (): DesktopBundleService => {
    const layout = new DesktopBundleLayoutStore();
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    return new DesktopBundleService({
      layout,
      stateStore,
      launcherVersion: this.options.launcherVersion
    });
  };
}

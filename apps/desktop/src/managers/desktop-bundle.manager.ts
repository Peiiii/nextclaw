import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveDesktopLauncherBuildFingerprint } from "../utils/desktop-paths.utils";
import { DesktopBundleLifecycleService } from "../launcher/services/bundle-lifecycle.service";
import { DesktopBundleService } from "../launcher/services/bundle.service";
import { DesktopUpdateService } from "../launcher/services/update.service";
import { DesktopBundleLayoutStore } from "../launcher/stores/bundle-layout.store";
import { DesktopLauncherStateStore } from "../launcher/stores/launcher-state.store";
import { DesktopBundleBootstrapService } from "../services/desktop-bundle-bootstrap.service";
import { DesktopUpdateSourceService, type GitHubPublishTarget } from "../services/desktop-update-source.service";

type DesktopBundleManagerLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

type DesktopBundleManagerOptions = {
  logger: DesktopBundleManagerLogger;
  launcherVersion: string;
  isPackaged: boolean;
  appPath: string;
  resourcesPath: string;
  publishTarget: GitHubPublishTarget | null;
};

export class DesktopBundleManager {
  readonly layout: DesktopBundleLayoutStore;
  readonly launcherStateStore: DesktopLauncherStateStore;
  readonly bundleService: DesktopBundleService;
  readonly bundleLifecycle: DesktopBundleLifecycleService;
  readonly updateSourceService: DesktopUpdateSourceService;
  readonly updateService: DesktopUpdateService;
  readonly bootstrap: DesktopBundleBootstrapService;

  constructor(private readonly options: DesktopBundleManagerOptions) {
    this.layout = new DesktopBundleLayoutStore();
    this.launcherStateStore = new DesktopLauncherStateStore(this.layout.getLauncherStatePath());
    this.bundleService = new DesktopBundleService({
      layout: this.layout,
      stateStore: this.launcherStateStore,
      launcherVersion: this.options.launcherVersion
    });
    this.bundleLifecycle = new DesktopBundleLifecycleService({
      layout: this.layout,
      stateStore: this.launcherStateStore,
      bundleService: this.bundleService
    });
    this.updateSourceService = new DesktopUpdateSourceService({
      isPackaged: this.options.isPackaged,
      appPath: this.options.appPath,
      resourcesPath: this.options.resourcesPath,
      publishTarget: this.options.publishTarget,
      stateStore: this.launcherStateStore
    });
    this.updateService = new DesktopUpdateService({
      layout: this.layout,
      resolveChannel: this.updateSourceService.resolveChannel,
      launcherVersion: this.options.launcherVersion,
      bundlePublicKey: this.resolveBundlePublicKey()
    });
    this.bootstrap = new DesktopBundleBootstrapService({
      logger: this.options.logger,
      launcherVersion: this.options.launcherVersion,
      channel: this.updateSourceService.resolveChannel(),
      resolveManifestUrl: this.updateSourceService.resolveManifestUrl,
      bundlePublicKey: this.resolveBundlePublicKey() ?? null,
      seedBundlePath: this.resolveSeedBundlePath() ?? null,
      seedBundleMetadata: this.updateSourceService.resolvePackagedSeedBundleMetadata(),
      launcherBuildFingerprint: resolveDesktopLauncherBuildFingerprint(
        this.options.appPath,
        this.options.launcherVersion
      ),
      layout: this.layout,
      launcherStateStore: this.launcherStateStore,
      bundleService: this.bundleService,
      bundleLifecycle: this.bundleLifecycle,
      updateService: this.updateService
    });
  }

  ensureInitialBundleAvailability = async (): Promise<void> => {
    await this.bootstrap.ensureInitialBundleAvailability();
  };

  recoverPendingBundleCandidate = async (): Promise<void> => {
    await this.bootstrap.recoverPendingBundleCandidate();
  };

  pruneRetainedBundleArtifacts = async (): Promise<void> => {
    await this.bootstrap.pruneRetainedBundleArtifacts();
  };

  markBundleHealthy = async (version: string): Promise<void> => {
    await this.bootstrap.markBundleHealthy(version);
  };

  repairPackagedSeedBundle = async (failedBundleVersion: string): Promise<boolean> =>
    await this.bootstrap.repairPackagedSeedBundle(failedBundleVersion);

  private resolveBundlePublicKey = (): string | undefined => {
    const publicKey = process.env.NEXTCLAW_DESKTOP_BUNDLE_PUBLIC_KEY?.trim();
    if (publicKey) {
      return publicKey;
    }

    const publicKeyPath = this.options.isPackaged
      ? join(this.options.resourcesPath, "update", "update-bundle-public.pem")
      : resolve(this.options.appPath, "build", "update-bundle-public.pem");
    if (!existsSync(publicKeyPath)) {
      return undefined;
    }

    const bundledPublicKey = readFileSync(publicKeyPath, "utf8").trim();
    return bundledPublicKey ? bundledPublicKey : undefined;
  };

  private resolveSeedBundlePath = (): string | undefined => {
    const seedBundlePath = this.options.isPackaged
      ? join(this.options.resourcesPath, "update", "seed-product-bundle.zip")
      : resolve(this.options.appPath, "build", "update", "seed-product-bundle.zip");
    if (!existsSync(seedBundlePath)) {
      return undefined;
    }
    return seedBundlePath;
  };
}

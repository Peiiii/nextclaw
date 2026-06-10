import { NpmRuntimeBundleLayoutStore } from "@nextclaw-service/stores/npm-runtime-bundle-layout.store.js";
import { NpmRuntimeBundleService } from "@nextclaw-service/services/runtime/npm-runtime-bundle.service.js";
import { RuntimeUpdateManager } from "@nextclaw-service/managers/runtime-update.manager.js";
import { NpmRuntimeUpdateService } from "@nextclaw-service/services/runtime/npm-runtime-update.service.js";
import { NpmRuntimeUpdateSourceService } from "@nextclaw-service/services/runtime/npm-runtime-update-source.service.js";
import { NpmRuntimeUpdateStateStore } from "@nextclaw-service/stores/npm-runtime-update-state.store.js";
import { NextclawDistributionService } from "@nextclaw-service/services/runtime/nextclaw-distribution.service.js";
import type { UpdateCommandOptions } from "@nextclaw-service/types/cli.types.js";
import type { UpdateProgress, UpdateSnapshot } from "@nextclaw/kernel";

export class NpmRuntimeUpdateCommandService {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  run = async (opts: UpdateCommandOptions): Promise<UpdateSnapshot> => {
    const snapshot = await this.runManaged(opts);
    if (opts.json) {
      console.log(JSON.stringify(snapshot, null, 2));
    } else {
      this.printSnapshot(snapshot);
    }
    return snapshot;
  };

  runManaged = async (opts: UpdateCommandOptions): Promise<UpdateSnapshot> => {
    if (this.env.NEXTCLAW_DESKTOP_COMMAND_SURFACE === "1") {
      return this.createDesktopCommandSurfaceBlockedSnapshot(opts);
    }

    const downloadOnly = Boolean(opts.downloadOnly || opts.download);
    const distribution = NextclawDistributionService.get();
    const source = new NpmRuntimeUpdateSourceService({
      packagedPublicKeyPath: distribution.runtimeUpdatePublicKeyPath,
    });
    const launcherVersion = distribution.version;
    const channel = source.resolveChannel(opts.channel, launcherVersion);
    const manifestUrl = source.resolveManifestUrl(channel, opts.manifestUrl);
    const layout = new NpmRuntimeBundleLayoutStore();
    const stateStore = new NpmRuntimeUpdateStateStore(layout.getStatePath(), {
      defaultChannel: channel
    });
    const bundleService = new NpmRuntimeBundleService({
      layout,
      stateStore,
      launcherVersion
    });
    const updateService = new NpmRuntimeUpdateService({
      layout,
      bundleService,
      launcherVersion,
      bundlePublicKey: source.resolveBundlePublicKey() ?? undefined
    });
    const manager = new RuntimeUpdateManager({
      layout,
      stateStore,
      bundleService,
      updateService,
      resolveManifestUrl: () => manifestUrl,
      launcherVersion,
      channel
    });

    return await manager.run({
      apply: Boolean(opts.apply),
      checkOnly: Boolean(opts.check),
      applyAfterDownload: !downloadOnly,
      onProgress: opts.json ? undefined : this.printProgress
    });
  };

  private printProgress = (progress: UpdateProgress): void => {
    const percent = progress.percent === null ? "" : ` ${progress.percent}%`;
    const total = progress.totalBytes === null ? "" : ` / ${progress.totalBytes} bytes`;
    process.stdout.write(`\rDownloading${percent} (${progress.downloadedBytes} bytes${total})`);
    if (progress.percent === 100) {
      process.stdout.write("\n");
    }
  };

  private printSnapshot = (snapshot: UpdateSnapshot): void => {
    if (snapshot.status === "blocked") {
      console.error(`Update blocked: ${snapshot.errorMessage ?? snapshot.blockReason ?? "unknown reason"}`);
      if (snapshot.recoveryCommand) {
        console.error(`Recovery: ${snapshot.recoveryCommand}`);
      }
      return;
    }
    if (snapshot.status === "failed") {
      console.error(`Update failed: ${snapshot.errorMessage ?? "unknown error"}`);
      return;
    }
    if (snapshot.status === "up-to-date") {
      console.log(`NextClaw runtime is already up to date (${snapshot.currentVersion ?? snapshot.hostVersion ?? "unknown"}).`);
      return;
    }
    if (snapshot.status === "downloaded") {
      console.log(`Runtime update downloaded: ${snapshot.downloadedVersion ?? snapshot.availableVersion}`);
      console.log("Run `nextclaw update --apply` to switch to the downloaded runtime.");
      return;
    }
    if (snapshot.status === "restart-required") {
      console.log(`Runtime update applied: ${snapshot.currentVersion}`);
      console.log("Restart the running NextClaw service or start a new CLI process to use it.");
      return;
    }
    if (snapshot.status === "update-available") {
      console.log(`Runtime update available: ${snapshot.currentVersion ?? "none"} -> ${snapshot.availableVersion}`);
      return;
    }
    console.log(`Update status: ${snapshot.status}`);
  };

  private createDesktopCommandSurfaceBlockedSnapshot = (opts: UpdateCommandOptions): UpdateSnapshot => {
    const distribution = NextclawDistributionService.get();
    return {
      status: "blocked",
      installationKind: "desktop-bundle",
      channel: opts.channel === "beta" ? "beta" : "stable",
      hostVersion: distribution.version,
      currentVersion: distribution.version,
      availableVersion: null,
      downloadedVersion: null,
      minimumHostVersion: null,
      releaseNotesUrl: null,
      lastCheckedAt: new Date().toISOString(),
      progress: null,
      canAutoDownload: false,
      canApplyInApp: false,
      requiresRestart: false,
      blockReason: "unsupported-installation",
      recoveryCommand: "Use the desktop update settings or restart NextClaw Desktop to check for desktop updates.",
      errorMessage: "The desktop-installed nextclaw command uses the desktop update channel instead of the npm runtime updater.",
      preferences: {
        automaticChecks: false,
        autoDownload: false
      }
    };
  };
}

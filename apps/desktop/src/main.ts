import { app, BrowserWindow, dialog } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import desktopPackageJson from "../package.json";
import { DesktopBundleLifecycleService } from "./launcher/services/bundle-lifecycle.service";
import { DesktopUpdateService } from "./launcher/services/update.service";
import { DesktopBundleLayoutStore } from "./launcher/stores/bundle-layout.store";
import { DesktopLauncherStateStore } from "./launcher/stores/launcher-state.store";
import { RuntimeConfigResolver } from "./runtime-config";
import { RuntimeServiceProcess } from "./runtime-service";
import {
  createDesktopLogger,
  installDesktopProcessErrorLogging,
  logDesktopMainEntryLoaded
} from "./utils/desktop-logging.utils";
import { createDesktopRuntimeEnv, resolveDesktopDataDir, resolveDesktopRuntimeHome } from "./utils/desktop-paths.utils";
import { attachWindowDiagnostics } from "./utils/window-diagnostics.utils";

const logger = createDesktopLogger();

installDesktopProcessErrorLogging(logger);
logDesktopMainEntryLoaded(logger);

class DesktopApplication {
  private runtime: RuntimeServiceProcess | null = null;
  private window: BrowserWindow | null = null;
  private stopping = false;

  start = async (): Promise<void> => {
    logger.info("Desktop start requested.");
    const acquiredSingleInstanceLock = app.requestSingleInstanceLock();
    logger.info(`Single instance lock acquired: ${String(acquiredSingleInstanceLock)}`);
    if (!acquiredSingleInstanceLock) {
      logger.warn("Another desktop instance is already running. Exiting the new process.");
      app.quit();
      return;
    }

    app.on("second-instance", () => {
      if (this.window) {
        if (this.window.isMinimized()) {
          this.window.restore();
        }
        this.window.focus();
      }
    });

    app.on("window-all-closed", () => {
      logger.info("All desktop windows closed. Quitting launcher.");
      app.quit();
    });
    app.on("before-quit", (event) => {
      logger.info(`before-quit received. stopping=${String(this.stopping)}`);
      if (this.stopping) {
        return;
      }
      this.stopping = true;
      event.preventDefault();
      void this.stopRuntime().finally(() => {
        app.quit();
      });
    });

    logger.info("Waiting for Electron app readiness.");
    await app.whenReady();
    logger.info(
      [
        "Electron app is ready.",
        `userData=${app.getPath("userData")}`,
        `logs=${app.getPath("logs")}`,
        `resourcesPath=${process.resourcesPath}`,
        `appPath=${app.getAppPath()}`,
        `resolvedDesktopDataDir=${resolveDesktopDataDir()}`,
        `resolvedRuntimeHome=${resolveDesktopRuntimeHome()}`
      ].join(" ")
    );
    const loaded = await this.bootstrapRuntimeAndWindow();
    if (!loaded) {
      logger.warn("Desktop bootstrap returned false. Quitting launcher.");
      app.quit();
    }
  };

  private bootstrapRuntimeAndWindow = async (): Promise<boolean> => {
    try {
      logger.info("Bootstrapping runtime and desktop window.");
      await this.ensureInitialBundleAvailability();
      await this.recoverPendingBundleCandidate();
      const runtimeCommand = new RuntimeConfigResolver().resolveCommand();
      logger.info(`Runtime source: ${runtimeCommand.source}`);
      if (runtimeCommand.source === "bundle") {
        logger.info(`Bundle version: ${runtimeCommand.bundleVersion ?? "unknown"}`);
      }
      const runtime = new RuntimeServiceProcess({
        logger,
        scriptPath: runtimeCommand.scriptPath,
        runtimeEnv: createDesktopRuntimeEnv()
      });
      const { baseUrl } = await runtime.start();
      this.runtime = runtime;
      this.window = this.createWindow();
      logger.info(`Loading desktop window URL: ${baseUrl}`);
      await this.window.loadURL(baseUrl);
      if (runtimeCommand.source === "bundle" && runtimeCommand.bundleVersion) {
        await this.markBundleHealthy(runtimeCommand.bundleVersion);
      }
      void this.checkForBackgroundBundleUpdate(runtimeCommand.bundleVersion ?? null);
      return true;
    } catch (error) {
      logger.error(`Failed to bootstrap runtime: ${String(error)}`);
      const result = await dialog.showMessageBox({
        type: "error",
        title: "NextClaw Desktop Failed to Start",
        message: "Unable to start local NextClaw runtime.",
        detail: error instanceof Error ? error.message : String(error),
        buttons: ["Open Logs", "Quit"],
        defaultId: 0,
        cancelId: 1
      });
      if (result.response === 0) {
        await app.whenReady();
        const logPath = join(app.getPath("logs"), "main.log");
        this.window = this.createWindow();
        await this.window.loadURL(`data:text/plain,${encodeURIComponent(`Check logs at: ${logPath}`)}`);
        return true;
      }
      await this.stopRuntime();
      return false;
    }
  };

  private ensureInitialBundleAvailability = async (): Promise<void> => {
    const stateStore = this.createLauncherStateStore();
    const currentVersion = stateStore.read().currentVersion;
    if (currentVersion) {
      return;
    }

    const seedBundlePath = this.getSeedBundlePath();
    if (seedBundlePath) {
      logger.info("No active product bundle found. Desktop will install the packaged seed bundle before boot.");
      try {
        const stagedSeedBundle = await this.createUpdateService().stageLocalArchive(seedBundlePath);
        logger.info(`Prepared packaged seed bundle ${stagedSeedBundle.activatedVersion} for desktop startup.`);
        return;
      } catch (error) {
        logger.warn(`Failed to install packaged seed bundle: ${String(error)}`);
      }
    }

    const manifestUrl = this.getUpdateManifestUrl();
    if (!manifestUrl) {
      return;
    }

    logger.info("No active product bundle found. Desktop will try to fetch the latest stable bundle before boot.");
    try {
      const result = await this.createUpdateService().stageUpdate(manifestUrl, null);
      if (!result) {
        logger.warn("Update manifest returned no bundle for initial desktop bootstrap.");
        return;
      }
      if (result.kind === "launcher-update-required") {
        logger.warn(
          `Initial bundle bootstrap requires launcher >= ${result.manifest.minimumLauncherVersion}; current launcher is ${app.getVersion()}.`
        );
        return;
      }
      if (result.kind === "quarantined-bad-version") {
        logger.warn(`Initial bundle bootstrap skipped quarantined bad version ${result.manifest.latestVersion}.`);
        return;
      }
      logger.info(`Prepared initial bundle ${result.activatedVersion} for desktop startup.`);
    } catch (error) {
      logger.warn(`Failed to fetch initial desktop bundle: ${String(error)}`);
    }
  };

  private recoverPendingBundleCandidate = async (): Promise<void> => {
    const lifecycle = this.createBundleLifecycle();
    const rollbackResult = await lifecycle.recoverPendingCandidate();
    if (!rollbackResult) {
      return;
    }
    if (rollbackResult.rolledBackTo) {
      logger.warn(
        [
          `Rolled back unconfirmed bundle ${rollbackResult.rolledBackFrom}.`,
          `Launcher restored ${rollbackResult.rolledBackTo} before starting desktop again.`
        ].join(" ")
      );
      return;
    }
    logger.warn(
      [
        `Cleared unconfirmed bundle ${rollbackResult.rolledBackFrom}.`,
        "No known-good bundle was available for rollback."
      ].join(" ")
    );
  };

  private markBundleHealthy = async (version: string): Promise<void> => {
    await this.createBundleLifecycle().markVersionHealthy(version);
    logger.info(`Bundle version marked healthy: ${version}`);
  };

  private checkForBackgroundBundleUpdate = async (currentVersion: string | null): Promise<void> => {
    const manifestUrl = this.getUpdateManifestUrl();
    if (!manifestUrl) {
      return;
    }

    try {
      const result = await this.createUpdateService().stageUpdate(manifestUrl, currentVersion);
      if (!result) {
        logger.info("Desktop update check completed: already on latest bundle.");
        return;
      }
      if (result.kind === "launcher-update-required") {
        logger.warn(
          `Desktop bundle update requires launcher >= ${result.manifest.minimumLauncherVersion}; current launcher is ${app.getVersion()}.`
        );
        return;
      }
      if (result.kind === "quarantined-bad-version") {
        logger.warn(`Desktop update skipped quarantined bad version ${result.manifest.latestVersion}.`);
        return;
      }

      logger.info(
        [
          `Desktop bundle update staged: ${result.activatedVersion}.`,
          "Restart the launcher to switch UI, runtime, and bundled plugins together."
        ].join(" ")
      );
      const window = this.window;
      const dialogOptions = {
        type: "info" as const,
        title: "NextClaw Update Ready",
        message: `Version ${result.activatedVersion} has been downloaded and is ready to install.`,
        detail: "Restart NextClaw now to apply the new bundle. If the new version fails to boot, the launcher will roll back automatically.",
        buttons: ["Restart Now", "Later"],
        defaultId: 0,
        cancelId: 1
      };
      const response = window
        ? await dialog.showMessageBox(window, dialogOptions)
        : await dialog.showMessageBox(dialogOptions);
      if (response.response === 0) {
        app.relaunch();
        app.quit();
      }
    } catch (error) {
      logger.warn(`Desktop background update check failed: ${String(error)}`);
    }
  };

  private createBundleLifecycle = (): DesktopBundleLifecycleService => {
    const layout = new DesktopBundleLayoutStore();
    return new DesktopBundleLifecycleService({
      layout,
      stateStore: new DesktopLauncherStateStore(layout.getLauncherStatePath())
    });
  };

  private createUpdateService = (): DesktopUpdateService => {
    return new DesktopUpdateService({
      layout: new DesktopBundleLayoutStore(),
      launcherVersion: app.getVersion(),
      bundlePublicKey: this.getBundlePublicKey()
    });
  };

  private createLauncherStateStore = (): DesktopLauncherStateStore => {
    const layout = new DesktopBundleLayoutStore();
    return new DesktopLauncherStateStore(layout.getLauncherStatePath());
  };

  private getUpdateManifestUrl = (): string | null => {
    const manifestUrl = process.env.NEXTCLAW_DESKTOP_UPDATE_MANIFEST_URL?.trim();
    if (manifestUrl) {
      return manifestUrl;
    }
    if (!app.isPackaged) {
      return null;
    }

    const publishTarget = this.getGitHubPublishTarget();
    if (!publishTarget) {
      return null;
    }

    return `https://github.com/${publishTarget.owner}/${publishTarget.repo}/releases/latest/download/manifest-stable-${process.platform}-${process.arch}.json`;
  };

  private getBundlePublicKey = (): string | undefined => {
    const publicKey = process.env.NEXTCLAW_DESKTOP_BUNDLE_PUBLIC_KEY?.trim();
    if (publicKey) {
      return publicKey;
    }

    const publicKeyPath = app.isPackaged
      ? join(process.resourcesPath, "update", "update-bundle-public.pem")
      : resolve(app.getAppPath(), "build", "update-bundle-public.pem");
    if (!existsSync(publicKeyPath)) {
      return undefined;
    }

    const bundledPublicKey = readFileSync(publicKeyPath, "utf8").trim();
    return bundledPublicKey ? bundledPublicKey : undefined;
  };

  private getSeedBundlePath = (): string | undefined => {
    const seedBundlePath = app.isPackaged
      ? join(process.resourcesPath, "update", "seed-product-bundle.zip")
      : resolve(app.getAppPath(), "build", "update", "seed-product-bundle.zip");
    if (!existsSync(seedBundlePath)) {
      return undefined;
    }
    return seedBundlePath;
  };

  private getGitHubPublishTarget = (): { owner: string; repo: string } | null => {
    const publish = (desktopPackageJson as { build?: { publish?: unknown } }).build?.publish;
    const publishTargets = Array.isArray(publish) ? publish : [];
    const githubTarget = publishTargets.find((entry) => {
      const provider = (entry as { provider?: unknown }).provider;
      return provider === "github";
    }) as { owner?: unknown; repo?: unknown } | undefined;
    const owner = typeof githubTarget?.owner === "string" ? githubTarget.owner.trim() : "";
    const repo = typeof githubTarget?.repo === "string" ? githubTarget.repo.trim() : "";
    if (!owner || !repo) {
      return null;
    }
    return { owner, repo };
  };

  private stopRuntime = async (): Promise<void> => {
    const runtime = this.runtime;
    this.runtime = null;
    if (!runtime) {
      return;
    }
    try {
      await runtime.stop();
    } catch (error) {
      logger.warn(`Failed to stop runtime cleanly: ${String(error)}`);
    }
  };

  private createWindow = (): BrowserWindow => {
    const window = new BrowserWindow({
      width: 1360,
      height: 920,
      minWidth: 1080,
      minHeight: 720,
      title: "NextClaw Desktop",
      webPreferences: {
        preload: join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    attachWindowDiagnostics(window, logger);

    window.on("closed", () => {
      this.window = null;
    });

    return window;
  };
}

const desktop = new DesktopApplication();
void desktop.start();

import { app, BrowserWindow, dialog } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import desktopPackageJson from "../package.json";
import { DesktopBundleLifecycleService } from "./launcher/services/bundle-lifecycle.service";
import { DesktopBundleService } from "./launcher/services/bundle.service";
import { DesktopUpdateService } from "./launcher/services/update.service";
import { DesktopBundleLayoutStore } from "./launcher/stores/bundle-layout.store";
import { DesktopLauncherStateStore } from "./launcher/stores/launcher-state.store";
import { RuntimeConfigResolver } from "./runtime-config";
import { RuntimeServiceProcess } from "./runtime-service";
import { DesktopBundleBootstrapService } from "./services/desktop-bundle-bootstrap.service";
import { DesktopUpdateShellService } from "./services/desktop-update-shell.service";
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
  private desktopUpdateShell: DesktopUpdateShellService | null = null;
  private bundleBootstrap: DesktopBundleBootstrapService | null = null;

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
    this.ensureDesktopUpdateShell().registerIpcHandlers();
    this.ensureDesktopUpdateShell().installApplicationMenu();
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
      await this.ensureBundleBootstrap().ensureInitialBundleAvailability();
      await this.ensureBundleBootstrap().recoverPendingBundleCandidate();
      await this.ensureBundleBootstrap().pruneRetainedBundleArtifacts();
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
      this.ensureDesktopUpdateShell();
      this.window = this.createWindow();
      logger.info(`Loading desktop window URL: ${baseUrl}`);
      await this.window.loadURL(baseUrl);
      if (runtimeCommand.source === "bundle" && runtimeCommand.bundleVersion) {
        await this.ensureBundleBootstrap().markBundleHealthy(runtimeCommand.bundleVersion);
      }
      void this.ensureDesktopUpdateShell().runStartupCheck();
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

  private createBundleService = (): DesktopBundleService => {
    const layout = new DesktopBundleLayoutStore();
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    return new DesktopBundleService({
      layout,
      stateStore,
      launcherVersion: app.getVersion()
    });
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
        launcherVersion: app.getVersion()
      })
    });
  };

  private ensureBundleBootstrap = (): DesktopBundleBootstrapService => {
    if (this.bundleBootstrap) {
      return this.bundleBootstrap;
    }
    this.bundleBootstrap = new DesktopBundleBootstrapService({
      logger,
      launcherVersion: app.getVersion(),
      manifestUrl: this.getUpdateManifestUrl(),
      bundlePublicKey: this.getBundlePublicKey() ?? null,
      seedBundlePath: this.getSeedBundlePath() ?? null
    });
    return this.bundleBootstrap;
  };

  private ensureDesktopUpdateShell = (): DesktopUpdateShellService => {
    if (this.desktopUpdateShell) {
      return this.desktopUpdateShell;
    }

    this.desktopUpdateShell = new DesktopUpdateShellService({
      logger,
      launcherVersion: app.getVersion(),
      manifestUrl: this.getUpdateManifestUrl(),
      getWindow: () => this.window,
      createLauncherStateStore: this.createLauncherStateStore,
      createUpdateService: this.createUpdateService,
      createBundleLifecycle: this.createBundleLifecycle,
      createBundleService: this.createBundleService,
      restartApplication: () => {
        app.relaunch();
        app.quit();
      }
    });

    return this.desktopUpdateShell;
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

import { app, BrowserWindow, dialog } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import desktopPackageJson from "../package.json";
import type { RuntimeCommand } from "./runtime-config";
import { DesktopBundleServicesFactory } from "./services/desktop-bundle-services.service";
import { DesktopPresenceService } from "./services/desktop-presence.service";
import { setupDesktopInstallationProfile } from "./utils/desktop-installation-profile-electron.utils";
import { DesktopRuntimeControlService } from "./services/desktop-runtime-control.service";
import { DesktopUpdateSourceService } from "./services/desktop-update-source.service";
import { DesktopWindowControlService } from "./services/desktop-window-control.service";
import { RuntimeServiceProcess } from "./runtime-service";
import { DesktopBundleBootstrapService } from "./services/desktop-bundle-bootstrap.service";
import {
  createDesktopCommandSurfaceService,
  type DesktopCommandSurfaceResult
} from "./services/desktop-command-surface.service";
import { DesktopRuntimeCommandService } from "./services/desktop-runtime-command.service";
import { DesktopUpdateShellService } from "./services/desktop-update-shell.service";
import {
  createDesktopLogger,
  installDesktopProcessErrorLogging,
  logDesktopMainEntryLoaded
} from "./utils/desktop-logging.utils";
import {
  createDesktopRuntimeEnv,
  resolveDesktopDataDir,
  resolveDesktopLauncherBuildFingerprint,
  resolveDesktopRuntimeHome
} from "./utils/desktop-paths.utils";
import { resolveDesktopGitHubPublishTarget } from "./utils/desktop-publish-target.utils";
import { createDesktopWindowOptions } from "./utils/desktop-window-options.utils";
import { attachWindowDiagnostics } from "./utils/window-diagnostics.utils";
const installationProfile = setupDesktopInstallationProfile(app);
const logger = createDesktopLogger();

installDesktopProcessErrorLogging(logger);
logDesktopMainEntryLoaded(logger, installationProfile);
class DesktopApplication {
  private runtime: RuntimeServiceProcess | null = null;
  private window: BrowserWindow | null = null;
  private stopping = false;
  private desktopRuntimeControlService: DesktopRuntimeControlService | null = null;
  private desktopPresenceService: DesktopPresenceService | null = null;
  private desktopUpdateShell: DesktopUpdateShellService | null = null;
  private desktopWindowControlService: DesktopWindowControlService | null = null;
  private bundleBootstrap: DesktopBundleBootstrapService | null = null;
  private runtimeCommandService: DesktopRuntimeCommandService | null = null;
  private updateSourceService: DesktopUpdateSourceService | null = null;
  private commandSurface: DesktopCommandSurfaceResult | null = null;
  private runtimeWindowUrl: string | null = null;
  private readonly bundleServices = new DesktopBundleServicesFactory({
    launcherVersion: app.getVersion(),
    resolveChannel: () => this.ensureUpdateSourceService().resolveChannel(),
    resolveBundlePublicKey: () => this.getBundlePublicKey()
  });

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
        this.ensureDesktopPresenceService().showMainWindow();
        return;
      }
      void this.restoreWindow();
    });
    app.on("window-all-closed", () => {
      this.ensureDesktopPresenceService().handleAllWindowsClosed();
    });
    app.on("before-quit", (event) => {
      logger.info(`before-quit received. stopping=${String(this.stopping)}`);
      if (this.stopping) {
        return;
      }
      if (!this.ensureDesktopPresenceService().handleBeforeQuit(event)) {
        return;
      }
      this.stopping = true;
      this.ensureDesktopPresenceService().markQuitting();
      event.preventDefault();
      void this.stopRuntime().finally(() => {
        app.quit();
      });
    });
    logger.info("Waiting for Electron app readiness.");
    await app.whenReady();
    await this.ensureUpdateSourceService().ensureStateChannelInitialized();
    this.ensureDesktopRuntimeControlService().registerIpcHandlers();
    this.ensureDesktopWindowControlService().registerIpcHandlers();
    this.ensureDesktopPresenceService().registerIpcHandlers();
    this.ensureDesktopUpdateShell().registerIpcHandlers();
    this.ensureDesktopUpdateShell().installApplicationMenu();
    this.ensureDesktopPresenceService().installTray();
    app.on("activate", () => {
      if (!this.window && this.runtimeWindowUrl) {
        void this.restoreWindow();
        return;
      }
      if (this.window) {
        this.ensureDesktopPresenceService().showMainWindow();
      }
    });
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
      this.ensureDesktopPresenceService().markQuitting();
      app.quit();
    }
  };
  private bootstrapRuntimeAndWindow = async (allowPackagedSeedRepair = true): Promise<boolean> => {
    let runtimeCommand: RuntimeCommand | null = null;
    try {
      logger.info("Bootstrapping runtime and desktop window.");
      const bundleBootstrap = this.ensureBundleBootstrap();
      const bundleBootstrapStartedAt = Date.now();
      await bundleBootstrap.recoverPendingBundleCandidate();
      await bundleBootstrap.pruneRetainedBundleArtifacts();
      logger.info(`Desktop bundle bootstrap finished in ${Date.now() - bundleBootstrapStartedAt}ms.`);
      runtimeCommand = await this.ensureRuntimeCommandService().resolve(bundleBootstrap);
      logger.info(`Runtime source: ${runtimeCommand.source}${runtimeCommand.bundleVersion ? ` bundleVersion=${runtimeCommand.bundleVersion}` : ""}${runtimeCommand.bundleDirectory ? ` bundleDirectory=${runtimeCommand.bundleDirectory}` : ""}`);
      await this.startRuntimeAndLoadWindow(runtimeCommand.scriptPath);
      if (runtimeCommand.source === "bundle" && runtimeCommand.bundleVersion) {
        await bundleBootstrap.markBundleHealthy(runtimeCommand.bundleVersion);
      }
      this.ensureRuntimeCommandService().prepareBundleAfterRuntimeStart(runtimeCommand, bundleBootstrap);
      void this.ensureDesktopUpdateShell().runStartupCheck();
      return true;
    } catch (error) {
      if (allowPackagedSeedRepair && runtimeCommand?.source === "bundle" && runtimeCommand.bundleVersion) {
        const repaired = await this.ensureBundleBootstrap().repairPackagedSeedBundle(runtimeCommand.bundleVersion);
        if (repaired) {
          logger.warn(`Retrying desktop bootstrap after packaged seed bundle repair for ${runtimeCommand.bundleVersion}.`);
          await this.stopRuntime();
          return await this.bootstrapRuntimeAndWindow(false);
        }
      }
      return await this.handleBootstrapFailure(error);
    }
  };
  private startRuntimeAndLoadWindow = async (scriptPath: string): Promise<void> => {
    const commandSurface = await this.ensureDesktopCommandSurface();
    const runtime = new RuntimeServiceProcess({
      logger,
      scriptPath,
      runtimeEnv: createDesktopRuntimeEnv({
        ...process.env,
        ...commandSurface.runtimeEnvPatch
      })
    });
    const runtimeStartStartedAt = Date.now();
    const { baseUrl } = await runtime.start();
    logger.info(`Desktop runtime startup finished in ${Date.now() - runtimeStartStartedAt}ms.`);
    this.runtime = runtime;
    this.runtimeWindowUrl = new URL("/chat", `${baseUrl.replace(/\/+$/, "")}/`).toString();
    this.ensureDesktopUpdateShell();
    this.window ??= this.createWindow();
    logger.info(`Loading desktop window URL: ${this.runtimeWindowUrl}`);
    await this.window.loadURL(this.runtimeWindowUrl);
  };
  private handleBootstrapFailure = async (error: unknown): Promise<boolean> => {
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
      await this.openBootstrapLogsWindow();
      return true;
    }
    await this.stopRuntime();
    return false;
  };
  private openBootstrapLogsWindow = async (): Promise<void> => {
    await app.whenReady();
    const logPath = join(app.getPath("logs"), "main.log");
    this.window ??= this.createWindow();
    await this.window.loadURL(`data:text/plain,${encodeURIComponent(`Check logs at: ${logPath}`)}`);
  };
  private ensureBundleBootstrap = (): DesktopBundleBootstrapService => {
    if (this.bundleBootstrap) {
      return this.bundleBootstrap;
    }
    this.bundleBootstrap = new DesktopBundleBootstrapService({
      logger,
      launcherVersion: app.getVersion(),
      channel: this.ensureUpdateSourceService().resolveChannel(),
      resolveManifestUrl: async () => await this.ensureUpdateSourceService().resolveManifestUrl(),
      bundlePublicKey: this.getBundlePublicKey() ?? null,
      seedBundlePath: this.getSeedBundlePath() ?? null,
      seedBundleMetadata: this.ensureUpdateSourceService().resolvePackagedSeedBundleMetadata(),
      launcherBuildFingerprint: this.resolveLauncherBuildFingerprint()
    });
    return this.bundleBootstrap;
  };
  private ensureRuntimeCommandService = (): DesktopRuntimeCommandService => {
    this.runtimeCommandService ??= new DesktopRuntimeCommandService(logger);
    return this.runtimeCommandService;
  };
  private ensureDesktopUpdateShell = (): DesktopUpdateShellService => {
    if (this.desktopUpdateShell) {
      return this.desktopUpdateShell;
    }
    this.desktopUpdateShell = new DesktopUpdateShellService({
      logger,
      launcherVersion: app.getVersion(),
      updateCapability: installationProfile.updateCapability,
      resolveChannel: () => this.ensureUpdateSourceService().resolveChannel(),
      resolveManifestUrl: async () => await this.ensureUpdateSourceService().resolveManifestUrl(),
      getWindow: () => this.window,
      createLauncherStateStore: this.bundleServices.createLauncherStateStore,
      createUpdateService: this.bundleServices.createUpdateService,
      createBundleLifecycle: this.bundleServices.createBundleLifecycle,
      createBundleService: this.bundleServices.createBundleService,
      requestApplicationQuit: () => {
        this.ensureDesktopPresenceService().requestExplicitQuit();
      },
      restartApplication: () => {
        this.ensureDesktopPresenceService().markQuitting();
        app.relaunch();
        app.quit();
      }
    });
    return this.desktopUpdateShell;
  };
  private ensureDesktopRuntimeControlService = (): DesktopRuntimeControlService => {
    if (this.desktopRuntimeControlService) {
      return this.desktopRuntimeControlService;
    }
    this.desktopRuntimeControlService = new DesktopRuntimeControlService({
      logger,
      restartRuntime: async () => {
        if (!this.runtime) {
          throw new Error("Desktop runtime is not available.");
        }
        await this.runtime.restart();
      },
      restartApplication: () => {
        this.ensureDesktopPresenceService().markQuitting();
        app.relaunch();
        app.quit();
      }
    });
    return this.desktopRuntimeControlService;
  };
  private ensureDesktopPresenceService = (): DesktopPresenceService => {
    if (this.desktopPresenceService) {
      return this.desktopPresenceService;
    }

    this.desktopPresenceService = new DesktopPresenceService({
      logger,
      getWindow: () => this.window,
      createLauncherStateStore: this.bundleServices.createLauncherStateStore,
      requestApplicationQuit: () => {
        app.quit();
      }
    });
    return this.desktopPresenceService;
  };
  private ensureDesktopWindowControlService = (): DesktopWindowControlService => {
    this.desktopWindowControlService ??= new DesktopWindowControlService();
    return this.desktopWindowControlService;
  };
  private ensureUpdateSourceService = (): DesktopUpdateSourceService => {
    if (this.updateSourceService) {
      return this.updateSourceService;
    }
    this.updateSourceService = new DesktopUpdateSourceService({
      isPackaged: app.isPackaged,
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath,
      publishTarget: resolveDesktopGitHubPublishTarget(desktopPackageJson),
      stateStore: this.bundleServices.createLauncherStateStore()
    });
    return this.updateSourceService;
  };

  private ensureDesktopCommandSurface = async (): Promise<DesktopCommandSurfaceResult> => {
    if (this.commandSurface) {
      return this.commandSurface;
    }
    this.commandSurface = await createDesktopCommandSurfaceService({
      profile: installationProfile,
      appExecutablePath: process.execPath,
      appIsPackaged: app.isPackaged,
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath,
      compiledMainDir: __dirname,
      launcherVersion: app.getVersion()
    }).ensure();
    logger.info(
      [
        "desktop.commandSurface.ready",
        `binDir=${this.commandSurface.binDir}`,
        `manifest=${this.commandSurface.manifestPath}`,
        `installationKind=${installationProfile.installationKind}`
      ].join(" ")
    );
    return this.commandSurface;
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

  private resolveLauncherBuildFingerprint = (): string =>
    resolveDesktopLauncherBuildFingerprint(app.getAppPath(), app.getVersion());

  private stopRuntime = async (): Promise<void> => {
    const runtime = this.runtime;
    this.runtime = null;
    this.runtimeWindowUrl = null;
    if (!runtime) {
      return;
    }
    try {
      await runtime.stop();
    } catch (error) {
      logger.warn(`Failed to stop runtime cleanly: ${String(error)}`);
    }
  };

  private restoreWindow = async (): Promise<void> => {
    if (this.window || !this.runtimeWindowUrl) {
      return;
    }
    this.window = this.createWindow();
    await this.window.loadURL(this.runtimeWindowUrl);
  };

  private createWindow = (): BrowserWindow => {
    const window = new BrowserWindow(createDesktopWindowOptions(join(__dirname, "preload.js")));
    this.ensureDesktopWindowControlService().attachWindow(window);
    attachWindowDiagnostics(window, logger);
    window.on("close", (event) => {
      this.ensureDesktopPresenceService().handleWindowClose(event);
    });
    window.on("closed", () => {
      this.window = null;
    });
    return window;
  };
}
const desktop = new DesktopApplication();
void desktop.start();

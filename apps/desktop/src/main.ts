import { app, dialog, type Event as ElectronEvent } from "electron";
import { join } from "node:path";
import desktopPackageJson from "../package.json";
import type { RuntimeCommand } from "./runtime-config";
import { DesktopBundleManager } from "./managers/desktop-bundle.manager";
import {
  DesktopCommandSurfaceManager,
  type DesktopCommandSurfaceResult
} from "./managers/desktop-command-surface.manager";
import { DesktopUpdateManager } from "./managers/desktop-update.manager";
import { DesktopWindowManager } from "./managers/desktop-window.manager";
import { DesktopPresenceService } from "./services/desktop-presence.service";
import { setupDesktopInstallationProfile } from "./utils/desktop-installation-profile-electron.utils";
import { DesktopRuntimeControlService } from "./services/desktop-runtime-control.service";
import { RuntimeServiceProcess } from "./runtime-service";
import { DesktopRuntimeCommandService } from "./services/desktop-runtime-command.service";
import {
  createDesktopLogger,
  installDesktopProcessErrorLogging,
  logDesktopMainEntryLoaded
} from "./utils/desktop-logging.utils";
import {
  createDesktopRuntimeEnv,
  resolveDesktopDataDir,
  resolveDesktopRuntimeHome
} from "./utils/desktop-paths.utils";
import { resolveDesktopGitHubPublishTarget } from "./utils/desktop-publish-target.utils";
const installationProfile = setupDesktopInstallationProfile(app);
const logger = createDesktopLogger();

installDesktopProcessErrorLogging(logger);
logDesktopMainEntryLoaded(logger, installationProfile);
class DesktopApplication {
  private runtime: RuntimeServiceProcess | null = null;
  private stopping = false;
  private readonly desktopRuntimeControlService: DesktopRuntimeControlService;
  private readonly desktopPresenceService: DesktopPresenceService;
  private readonly desktopUpdateManager: DesktopUpdateManager;
  private readonly runtimeCommandService: DesktopRuntimeCommandService;
  private commandSurface: DesktopCommandSurfaceResult | null = null;
  private readonly windowManager: DesktopWindowManager;
  private readonly bundleManager: DesktopBundleManager;
  private readonly commandSurfaceManager: DesktopCommandSurfaceManager;

  constructor() {
    this.bundleManager = new DesktopBundleManager({
      logger,
      launcherVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath,
      publishTarget: resolveDesktopGitHubPublishTarget(desktopPackageJson)
    });
    this.windowManager = new DesktopWindowManager({
      logger,
      compiledMainDir: __dirname,
      handleWindowClose: this.handleWindowClose
    });
    this.desktopPresenceService = new DesktopPresenceService({
      logger,
      windowManager: this.windowManager,
      launcherStateStore: this.bundleManager.launcherStateStore
    });
    this.runtimeCommandService = new DesktopRuntimeCommandService(logger, this.bundleManager);
    this.desktopRuntimeControlService = new DesktopRuntimeControlService({
      logger,
      restartRuntime: this.restartRuntime,
      restartApplication: this.restartApplication
    });
    this.desktopUpdateManager = new DesktopUpdateManager({
      logger,
      launcherVersion: app.getVersion(),
      updateCapability: installationProfile.updateCapability,
      bundleManager: this.bundleManager,
      presenceService: this.desktopPresenceService,
      windowManager: this.windowManager
    });
    this.commandSurfaceManager = new DesktopCommandSurfaceManager({
      profile: installationProfile,
      appExecutablePath: process.execPath,
      appIsPackaged: app.isPackaged,
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath,
      compiledMainDir: __dirname,
      launcherVersion: app.getVersion()
    });
  }

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
      if (this.windowManager.getWindow()) {
        this.desktopPresenceService.showMainWindow();
        return;
      }
      void this.windowManager.restoreRuntimeWindow();
    });
    app.on("window-all-closed", () => {
      this.desktopPresenceService.handleAllWindowsClosed();
    });
    app.on("before-quit", (event) => {
      logger.info(`before-quit received. stopping=${String(this.stopping)}`);
      if (this.stopping) {
        return;
      }
      if (!this.desktopPresenceService.handleBeforeQuit(event)) {
        return;
      }
      this.stopping = true;
      this.desktopPresenceService.markQuitting();
      event.preventDefault();
      void this.stopRuntime().finally(() => {
        this.dispose();
        app.quit();
      });
    });
    logger.info("Waiting for Electron app readiness.");
    await app.whenReady();
    await this.bundleManager.updateSourceService.ensureStateChannelInitialized();
    this.desktopRuntimeControlService.start();
    this.windowManager.start();
    this.desktopPresenceService.start();
    this.desktopUpdateManager.start();
    app.on("activate", () => {
      if (!this.windowManager.getWindow() && this.windowManager.hasRuntimeWindowUrl()) {
        void this.windowManager.restoreRuntimeWindow();
        return;
      }
      if (this.windowManager.getWindow()) {
        this.desktopPresenceService.showMainWindow();
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
      this.desktopPresenceService.markQuitting();
      this.dispose();
      app.quit();
    }
  };
  private bootstrapRuntimeAndWindow = async (allowPackagedSeedRepair = true): Promise<boolean> => {
    let runtimeCommand: RuntimeCommand | null = null;
    try {
      logger.info("Bootstrapping runtime and desktop window.");
      const bundleBootstrapStartedAt = Date.now();
      runtimeCommand = await this.runtimeCommandService.resolve();
      logger.info(`Desktop bundle bootstrap finished in ${Date.now() - bundleBootstrapStartedAt}ms.`);
      logger.info(`Runtime source: ${runtimeCommand.source}${runtimeCommand.bundleVersion ? ` bundleVersion=${runtimeCommand.bundleVersion}` : ""}${runtimeCommand.bundleDirectory ? ` bundleDirectory=${runtimeCommand.bundleDirectory}` : ""}`);
      await this.startRuntimeAndLoadWindow(runtimeCommand);
      if (runtimeCommand.source === "bundle" && runtimeCommand.bundleVersion) {
        await this.bundleManager.markBundleHealthy(runtimeCommand.bundleVersion);
      }
      this.runtimeCommandService.prepareBundleAfterRuntimeStart(runtimeCommand);
      void this.desktopUpdateManager.runStartupCheck();
      return true;
    } catch (error) {
      if (allowPackagedSeedRepair && runtimeCommand?.source === "bundle" && runtimeCommand.bundleVersion) {
        const repaired = await this.bundleManager.repairPackagedSeedBundle(runtimeCommand.bundleVersion);
        if (repaired) {
          logger.warn(`Retrying desktop bootstrap after packaged seed bundle repair for ${runtimeCommand.bundleVersion}.`);
          await this.stopRuntime();
          return await this.bootstrapRuntimeAndWindow(false);
        }
      }
      return await this.handleBootstrapFailure(error);
    }
  };
  private startRuntimeAndLoadWindow = async (runtimeCommand: RuntimeCommand): Promise<void> => {
    const commandSurface = await this.ensureDesktopCommandSurface();
    const runtime = new RuntimeServiceProcess({
      logger,
      scriptPath: runtimeCommand.scriptPath,
      runtimeEnv: createDesktopRuntimeEnv(
        {
          ...process.env,
          ...commandSurface.runtimeEnvPatch
        },
        {
          packagedExtensionDir: runtimeCommand.pluginsDirectory
        }
      )
    });
    const runtimeStartStartedAt = Date.now();
    const { baseUrl } = await runtime.start();
    logger.info(`Desktop runtime startup finished in ${Date.now() - runtimeStartStartedAt}ms.`);
    this.runtime = runtime;
    const runtimeWindowUrl = new URL("/chat", `${baseUrl.replace(/\/+$/, "")}/`).toString();
    await this.windowManager.loadRuntimeWindow(runtimeWindowUrl);
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
    await this.windowManager.loadTextWindow(`Check logs at: ${logPath}`);
  };
  private ensureDesktopCommandSurface = async (): Promise<DesktopCommandSurfaceResult> => {
    if (this.commandSurface) {
      return this.commandSurface;
    }
    this.commandSurface = await this.commandSurfaceManager.ensure();
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

  private stopRuntime = async (): Promise<void> => {
    const runtime = this.runtime;
    this.runtime = null;
    this.windowManager.clearRuntimeWindowUrl();
    if (!runtime) {
      return;
    }
    try {
      await runtime.stop();
    } catch (error) {
      logger.warn(`Failed to stop runtime cleanly: ${String(error)}`);
    }
  };

  private restartApplication = (): void => {
    this.desktopPresenceService.markQuitting();
    app.relaunch();
    this.dispose();
    app.quit();
  };

  private dispose = (): void => {
    this.desktopUpdateManager.dispose();
    this.desktopPresenceService.dispose();
    this.windowManager.dispose();
    this.desktopRuntimeControlService.dispose();
  };

  private handleWindowClose = (event: ElectronEvent): void => {
    this.desktopPresenceService.handleWindowClose(event);
  };

  private restartRuntime = async (): Promise<void> => {
    if (!this.runtime) {
      throw new Error("Desktop runtime is not available.");
    }
    await this.runtime.restart();
  };
}
const desktop = new DesktopApplication();
void desktop.start();

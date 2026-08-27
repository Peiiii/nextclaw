import { app, crashReporter, dialog, ipcMain, shell, type Event as ElectronEvent } from "electron";
import { resolveAutomaticUpdateCheckIntervalMs } from "@nextclaw/kernel/automatic-update-check";
import { mkdirSync } from "node:fs";
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
import { DesktopHostCapabilityService } from "./services/desktop-host-capability.service";
import { setupDesktopInstallationProfile } from "./utils/desktop-installation-profile-electron.utils";
import { DesktopRuntimeControlService } from "./services/desktop-runtime-control.service";
import { RuntimeServiceProcess } from "./runtime-service";
import { DesktopRuntimeCommandService } from "./services/desktop-runtime-command.service";
import {
  createDesktopLogger,
  logDesktopMainEntryLoaded
} from "./utils/desktop-logging.utils";
import {
  createDesktopRuntimeEnv,
  resolveDesktopDataDir,
  resolveDesktopRuntimeHome
} from "./utils/desktop-paths.utils";
import { resolveDesktopGitHubPublishTarget } from "./utils/desktop-publish-target.utils";
import { DesktopHostDiagnosticsService } from "./services/desktop-host-diagnostics.service";
import { launchDesktopGuardian } from "./launcher/desktop-guardian.utils";
const installationProfile = setupDesktopInstallationProfile(app);
const logger = createDesktopLogger();

logDesktopMainEntryLoaded(logger, installationProfile);
class DesktopApplication {
  private runtime: RuntimeServiceProcess | null = null;
  private stopping = false;
  private readonly desktopRuntimeControlService: DesktopRuntimeControlService;
  private readonly desktopHostCapabilityService: DesktopHostCapabilityService;
  private readonly desktopPresenceService: DesktopPresenceService;
  private readonly desktopUpdateManager: DesktopUpdateManager;
  private readonly runtimeCommandService: DesktopRuntimeCommandService;
  private commandSurface: DesktopCommandSurfaceResult | null = null;
  private readonly windowManager: DesktopWindowManager;
  private readonly bundleManager: DesktopBundleManager;
  private readonly commandSurfaceManager: DesktopCommandSurfaceManager;
  private readonly hostDiagnostics: DesktopHostDiagnosticsService;

  constructor() {
    this.bundleManager = new DesktopBundleManager({
      logger,
      launcherVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath,
      publishTarget: resolveDesktopGitHubPublishTarget(desktopPackageJson)
    });
    this.desktopHostCapabilityService = new DesktopHostCapabilityService({
      ipcMain,
      shell
    });
    this.windowManager = new DesktopWindowManager({
      logger,
      compiledMainDir: __dirname,
      handleWindowClose: this.handleWindowClose,
      attachExternalNavigation: this.desktopHostCapabilityService.attachExternalNavigation
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
      restartApplication: this.requestApplicationRestart
    });
    this.desktopUpdateManager = new DesktopUpdateManager({
      logger,
      launcherVersion: app.getVersion(),
      updateCapability: installationProfile.updateCapability,
      bundleManager: this.bundleManager,
      presenceService: this.desktopPresenceService,
      restartApplication: this.requestApplicationRestart,
      windowManager: this.windowManager,
      automaticCheckIntervalMs: resolveAutomaticUpdateCheckIntervalMs({
        verificationMode: process.env.NEXTCLAW_UPDATE_VERIFICATION_MODE === "1",
        verificationIntervalMs: process.env.NEXTCLAW_UPDATE_VERIFICATION_INTERVAL_MS
      })
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
    const crashDumpsPath = join(resolveDesktopRuntimeHome(), "diagnostics", "crash-dumps");
    mkdirSync(crashDumpsPath, { recursive: true });
    app.setPath("crashDumps", crashDumpsPath);
    this.hostDiagnostics = new DesktopHostDiagnosticsService({
      logger,
      launcherVersion: app.getVersion(),
      crashDumpsPath
    });
  }

  start = async (): Promise<void> => {
    logger.info("Desktop start requested.");
    if (this.handOffToDesktopGuardian()) {
      return;
    }
    if (!this.startHostDiagnosticsAndAcquireLock()) {
      return;
    }
    this.installApplicationLifecycleListeners();
    await this.startReadyServices();
    await this.bootstrapOrQuit();
  };
  private handOffToDesktopGuardian = (): boolean => {
    const launched = launchDesktopGuardian({
      enabled: app.isPackaged,
      executablePath: process.execPath,
      guardianScriptPath: join(__dirname, "launcher", "desktop-guardian.utils.js"),
      runtimeHome: resolveDesktopRuntimeHome()
    });
    if (launched) {
      logger.info("Desktop guardian launched. Handing off packaged Windows desktop startup.");
      app.quit();
    }
    return launched;
  };

  private startHostDiagnosticsAndAcquireLock = (): boolean => {
    crashReporter.start({
      productName: "NextClaw Desktop",
      uploadToServer: false,
      globalExtra: { nextclawRunId: process.env.NEXTCLAW_DESKTOP_RUN_ID ?? "standalone" }
    });
    this.hostDiagnostics.start();
    const acquiredSingleInstanceLock = app.requestSingleInstanceLock();
    logger.info(`Single instance lock acquired: ${String(acquiredSingleInstanceLock)}`);
    if (acquiredSingleInstanceLock) {
      return true;
    }
    logger.warn("Another desktop instance is already running. Exiting the new process.");
    this.hostDiagnostics.recordExitIntent("duplicate-instance");
    this.hostDiagnostics.complete({ outcome: "controlled-exit", code: 0 });
    app.quit();
    return false;
  };

  private installApplicationLifecycleListeners = (): void => {
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
      event.preventDefault();
      void this.shutdown({
        outcome: "controlled-exit",
        code: 0,
        relaunch: false,
        exitIntent: "desktop-before-quit"
      });
    });
  };

  private startReadyServices = async (): Promise<void> => {
    logger.info("Waiting for Electron app readiness.");
    await app.whenReady();
    await this.bundleManager.updateSourceService.ensureStateChannelInitialized();
    this.desktopRuntimeControlService.start();
    this.desktopHostCapabilityService.start();
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
    app.on("render-process-gone", (_event, _webContents, details) => {
      this.hostDiagnostics.recordRendererGone(details);
    });
    app.on("child-process-gone", (_event, details) => {
      this.hostDiagnostics.recordChildProcessGone(details);
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
  };

  private bootstrapOrQuit = async (): Promise<void> => {
    const loaded = await this.bootstrapRuntimeAndWindow();
    if (!loaded) {
      logger.warn("Desktop bootstrap returned false. Quitting launcher.");
      await this.shutdown({
        outcome: "controlled-exit",
        code: 1,
        relaunch: false,
        exitIntent: "desktop-bootstrap-failed"
      });
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
      void this.desktopUpdateManager.startAutomaticChecks();
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
          ...commandSurface.runtimeEnvPatch,
          ...(process.platform === "darwin"
            ? {
                NEXTCLAW_MACOS_ACCESSIBILITY_MODULE: join(process.resourcesPath, "native", "macos-accessibility.node"),
              }
            : {}),
        },
        {
          packagedExtensionDir: runtimeCommand.pluginsDirectory,
          ...(runtimeCommand.source === "environment-override"
            ? {
                nativeModuleRegisterPath: join(app.getAppPath(), "scripts", "native", "desktop-native-module-register.mjs"), nativeModulesDir: join(app.getAppPath(), "build", "native-app-resources", "node_modules")
              }
            : {})
        }
      ),
      onExit: this.hostDiagnostics.recordRuntimeChildExit
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

  private requestApplicationRestart = (): Promise<void> =>
    this.shutdown({
      outcome: "controlled-exit",
      code: 0,
      relaunch: true,
      exitIntent: "desktop-restart-requested"
    });

  private shutdown = async (params: {
    outcome: "controlled-exit";
    code: number;
    relaunch: boolean;
    exitIntent: string;
  }): Promise<void> => {
    const { code, exitIntent, outcome, relaunch } = params;
    if (this.stopping) {
      return;
    }
    this.stopping = true;
    this.desktopPresenceService.markQuitting();
    this.hostDiagnostics.recordExitIntent(exitIntent);
    await this.stopRuntime();
    await this.dispose();
    if (relaunch) {
      app.relaunch();
    }
    this.hostDiagnostics.complete({ outcome, code });
    app.quit();
  };

  private dispose = async (): Promise<void> => {
    this.desktopUpdateManager.dispose();
    this.desktopHostCapabilityService.dispose();
    this.desktopPresenceService.dispose();
    this.windowManager.dispose();
    this.desktopRuntimeControlService.dispose();
    this.hostDiagnostics.dispose();
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

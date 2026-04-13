import { Menu, app, dialog, ipcMain, type BrowserWindow, type MessageBoxOptions, type MenuItemConstructorOptions } from "electron";
import type { DesktopBundleLifecycleService } from "../launcher/services/bundle-lifecycle.service";
import type { DesktopBundleService } from "../launcher/services/bundle.service";
import {
  DesktopUpdateCoordinatorService,
  type DesktopUpdatePreferences,
  type DesktopUpdateSnapshot
} from "../launcher/services/update-coordinator.service";
import type { DesktopUpdateService } from "../launcher/services/update.service";
import type { DesktopLauncherStateStore } from "../launcher/stores/launcher-state.store";
import type { DesktopReleaseChannel } from "../launcher/stores/launcher-state.store";
import {
  DESKTOP_UPDATES_APPLY_CHANNEL,
  DESKTOP_UPDATES_CHECK_CHANNEL,
  DESKTOP_UPDATES_DOWNLOAD_CHANNEL,
  DESKTOP_UPDATES_GET_STATE_CHANNEL,
  DESKTOP_UPDATES_STATE_CHANGED_CHANNEL,
  DESKTOP_UPDATES_UPDATE_CHANNEL_CHANNEL,
  DESKTOP_UPDATES_UPDATE_PREFERENCES_CHANNEL
} from "../utils/desktop-ipc.utils";

type DesktopUpdateShellLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

type DesktopUpdateShellServiceOptions = {
  logger: DesktopUpdateShellLogger;
  launcherVersion: string;
  resolveChannel: () => DesktopReleaseChannel;
  resolveManifestUrl: () => Promise<string | null>;
  getWindow: () => BrowserWindow | null;
  createLauncherStateStore: () => DesktopLauncherStateStore;
  createUpdateService: () => DesktopUpdateService;
  createBundleLifecycle: () => DesktopBundleLifecycleService;
  createBundleService: () => DesktopBundleService;
  restartApplication: () => void;
};

export class DesktopUpdateShellService {
  private coordinator: DesktopUpdateCoordinatorService | null = null;

  constructor(private readonly options: DesktopUpdateShellServiceOptions) {}

  registerIpcHandlers = (): void => {
    ipcMain.removeHandler(DESKTOP_UPDATES_GET_STATE_CHANNEL);
    ipcMain.removeHandler(DESKTOP_UPDATES_CHECK_CHANNEL);
    ipcMain.removeHandler(DESKTOP_UPDATES_DOWNLOAD_CHANNEL);
    ipcMain.removeHandler(DESKTOP_UPDATES_APPLY_CHANNEL);
    ipcMain.removeHandler(DESKTOP_UPDATES_UPDATE_PREFERENCES_CHANNEL);
    ipcMain.removeHandler(DESKTOP_UPDATES_UPDATE_CHANNEL_CHANNEL);

    ipcMain.handle(DESKTOP_UPDATES_GET_STATE_CHANNEL, async () => this.ensureCoordinator().getSnapshot());
    ipcMain.handle(DESKTOP_UPDATES_CHECK_CHANNEL, async () => await this.ensureCoordinator().checkForUpdates({ manual: true }));
    ipcMain.handle(DESKTOP_UPDATES_DOWNLOAD_CHANNEL, async () => await this.ensureCoordinator().downloadUpdate());
    ipcMain.handle(DESKTOP_UPDATES_APPLY_CHANNEL, async () => {
      const snapshot = await this.ensureCoordinator().applyDownloadedUpdate();
      this.options.restartApplication();
      return snapshot;
    });
    ipcMain.handle(
      DESKTOP_UPDATES_UPDATE_PREFERENCES_CHANNEL,
      async (_event, preferences: Partial<DesktopUpdatePreferences> | undefined) =>
        await this.ensureCoordinator().updatePreferences(preferences ?? {})
    );
    ipcMain.handle(DESKTOP_UPDATES_UPDATE_CHANNEL_CHANNEL, async (_event, channel: DesktopReleaseChannel | undefined) => {
      return await this.ensureCoordinator().updateChannel(channel === "beta" ? "beta" : "stable");
    });
  };

  installApplicationMenu = (): void => {
    const snapshot = this.coordinator?.getSnapshot();
    const template: MenuItemConstructorOptions[] = [
      ...(process.platform === "darwin" ? [this.createDarwinAppMenu(snapshot)] : []),
      { role: "fileMenu" },
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
      this.createHelpMenu(snapshot)
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  };

  runStartupCheck = async (): Promise<void> => {
    await this.ensureCoordinator().runStartupCheck();
  };

  private ensureCoordinator = (): DesktopUpdateCoordinatorService => {
    if (this.coordinator) {
      return this.coordinator;
    }

    this.coordinator = new DesktopUpdateCoordinatorService({
      initialChannel: this.options.resolveChannel(),
      launcherVersion: this.options.launcherVersion,
      resolveManifestUrl: this.options.resolveManifestUrl,
      stateStore: this.options.createLauncherStateStore(),
      updateService: this.options.createUpdateService(),
      bundleLifecycle: this.options.createBundleLifecycle(),
      bundleService: this.options.createBundleService(),
      publishSnapshot: (snapshot) => {
        this.publishSnapshot(snapshot);
        this.installApplicationMenu();
      },
      onAutoDownloadedUpdateReady: async (snapshot) => {
        await this.showDownloadedUpdateDialog(snapshot);
      }
    });

    return this.coordinator;
  };

  private createDarwinAppMenu = (snapshot: DesktopUpdateSnapshot | undefined): MenuItemConstructorOptions => {
    return {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        this.createCheckForUpdatesMenuItem(),
        this.createDownloadUpdateMenuItem(snapshot),
        this.createApplyUpdateMenuItem(snapshot),
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    };
  };

  private createHelpMenu = (snapshot: DesktopUpdateSnapshot | undefined): MenuItemConstructorOptions => {
    return {
      role: "help",
      submenu: [
        this.createCheckForUpdatesMenuItem(),
        this.createDownloadUpdateMenuItem(snapshot),
        this.createApplyUpdateMenuItem(snapshot)
      ]
    };
  };

  private createCheckForUpdatesMenuItem = (): MenuItemConstructorOptions => {
    return {
      label: "Check for Updates",
      click: () => void this.handleManualUpdateCheck()
    };
  };

  private createDownloadUpdateMenuItem = (snapshot: DesktopUpdateSnapshot | undefined): MenuItemConstructorOptions => {
    return {
      label: "Download Update",
      enabled: snapshot?.status === "update-available",
      click: () => void this.handleManualUpdateDownload()
    };
  };

  private createApplyUpdateMenuItem = (snapshot: DesktopUpdateSnapshot | undefined): MenuItemConstructorOptions => {
    return {
      label: "Restart to Apply Update",
      enabled: snapshot?.status === "downloaded",
      click: () => void this.handleApplyDownloadedUpdate()
    };
  };

  private handleManualUpdateCheck = async (): Promise<void> => {
    try {
      const snapshot = await this.ensureCoordinator().checkForUpdates({ manual: true });
      if (snapshot.status === "up-to-date") {
        await dialog.showMessageBox({
          type: "info",
          title: "NextClaw is up to date",
          message: "You already have the latest desktop bundle.",
          buttons: ["OK"]
        });
        return;
      }
      if (snapshot.status === "update-available") {
        const response = await dialog.showMessageBox({
          type: "info",
          title: "NextClaw Update Available",
          message: `Version ${snapshot.availableVersion ?? "new"} is available.`,
          detail: "Download the update now and install it when you're ready to restart NextClaw.",
          buttons: ["Download Now", "Later"],
          defaultId: 0,
          cancelId: 1
        });
        if (response.response === 0) {
          await this.handleManualUpdateDownload();
        }
        return;
      }
      if (snapshot.status === "downloaded") {
        await this.showDownloadedUpdateDialog(snapshot);
        return;
      }
      if (snapshot.status === "failed" && snapshot.errorMessage) {
        await dialog.showMessageBox({
          type: "warning",
          title: "Desktop update check failed",
          message: snapshot.errorMessage,
          buttons: ["OK"]
        });
      }
    } catch (error) {
      await dialog.showMessageBox({
        type: "error",
        title: "Desktop update check failed",
        message: error instanceof Error ? error.message : String(error),
        buttons: ["OK"]
      });
    }
  };

  private handleManualUpdateDownload = async (): Promise<void> => {
    try {
      const snapshot = await this.ensureCoordinator().downloadUpdate();
      if (snapshot.status === "downloaded") {
        await this.showDownloadedUpdateDialog(snapshot);
      }
    } catch (error) {
      await dialog.showMessageBox({
        type: "error",
        title: "Desktop update download failed",
        message: error instanceof Error ? error.message : String(error),
        buttons: ["OK"]
      });
    }
  };

  private handleApplyDownloadedUpdate = async (): Promise<void> => {
    try {
      await this.ensureCoordinator().applyDownloadedUpdate();
      this.options.restartApplication();
    } catch (error) {
      await dialog.showMessageBox({
        type: "error",
        title: "Unable to apply desktop update",
        message: error instanceof Error ? error.message : String(error),
        buttons: ["OK"]
      });
    }
  };

  private showDownloadedUpdateDialog = async (snapshot: DesktopUpdateSnapshot): Promise<void> => {
    if (snapshot.status !== "downloaded") {
      return;
    }

    const dialogOptions: MessageBoxOptions = {
      type: "info",
      title: "NextClaw Update Ready",
      message: `Version ${snapshot.downloadedVersion ?? "new"} has been downloaded and is ready to install.`,
      detail: "Restart NextClaw now to apply the new bundle. If the new version fails to boot, the launcher will roll back automatically.",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1
    };
    const window = this.options.getWindow();
    const response =
      window && !window.isDestroyed()
        ? await dialog.showMessageBox(window, dialogOptions)
        : await dialog.showMessageBox(dialogOptions);
    if (response.response === 0) {
      await this.handleApplyDownloadedUpdate();
    }
  };

  private publishSnapshot = (snapshot: DesktopUpdateSnapshot): void => {
    this.options.logger.info(
      [
        "Desktop update snapshot changed.",
        `status=${snapshot.status}`,
        `channel=${snapshot.channel}`,
        `current=${snapshot.currentVersion ?? ""}`,
        `available=${snapshot.availableVersion ?? ""}`,
        `downloaded=${snapshot.downloadedVersion ?? ""}`,
        `autoChecks=${String(snapshot.preferences.automaticChecks)}`,
        `autoDownload=${String(snapshot.preferences.autoDownload)}`
      ].join(" ")
    );

    const window = this.options.getWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    window.webContents.send(DESKTOP_UPDATES_STATE_CHANGED_CHANNEL, snapshot);
  };
}

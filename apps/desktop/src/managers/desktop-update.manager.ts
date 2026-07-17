import { Menu, app, dialog, ipcMain, type MessageBoxOptions, type MenuItemConstructorOptions } from "electron";
import { AUTOMATIC_UPDATE_CHECK_INTERVAL_MS } from "@nextclaw/kernel/automatic-update-check";
import type { DesktopBundleManager } from "./desktop-bundle.manager";
import type { DesktopWindowManager } from "./desktop-window.manager";
import {
  DesktopUpdateCoordinatorService,
  type DesktopUpdateCapability,
  type DesktopUpdateSnapshot
} from "../launcher/services/update-coordinator.service";
import type { DesktopReleaseChannel } from "../launcher/stores/launcher-state.store";
import type { DesktopPresenceService } from "../services/desktop-presence.service";
import {
  DESKTOP_UPDATES_APPLY_CHANNEL,
  DESKTOP_UPDATES_CHECK_CHANNEL,
  DESKTOP_UPDATES_DOWNLOAD_CHANNEL,
  DESKTOP_UPDATES_GET_STATE_CHANNEL,
  DESKTOP_UPDATES_STATE_CHANGED_CHANNEL,
  DESKTOP_UPDATES_UPDATE_CHANNEL_CHANNEL
} from "../utils/desktop-ipc.utils";
import {
  drainDesktopCleanups,
  removeDesktopIpcHandlers,
  type DesktopCleanup
} from "../utils/desktop-lifecycle.utils";

type DesktopUpdateManagerLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

type DesktopUpdateManagerOptions = {
  logger: DesktopUpdateManagerLogger;
  launcherVersion: string;
  updateCapability?: DesktopUpdateCapability;
  bundleManager: DesktopBundleManager;
  presenceService: DesktopPresenceService;
  windowManager: DesktopWindowManager;
  automaticCheckIntervalMs?: number;
};

export class DesktopUpdateManager {
  private readonly cleanups: DesktopCleanup[] = [];
  private coordinator: DesktopUpdateCoordinatorService | null = null;
  private automaticCheckSchedulerStarted = false;
  private automaticCheckTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: DesktopUpdateManagerOptions) {}

  start = (): void => {
    this.dispose();
    this.registerIpcHandlers();
    this.installApplicationMenu();
    this.cleanups.push(() => {
      Menu.setApplicationMenu(null);
    });
  };

  dispose = (): void => {
    drainDesktopCleanups(this.cleanups);
  };

  private registerIpcHandlers = (): void => {
    const cleanupIpcHandlers = removeDesktopIpcHandlers(
      DESKTOP_UPDATES_GET_STATE_CHANNEL,
      DESKTOP_UPDATES_CHECK_CHANNEL,
      DESKTOP_UPDATES_DOWNLOAD_CHANNEL,
      DESKTOP_UPDATES_APPLY_CHANNEL,
      DESKTOP_UPDATES_UPDATE_CHANNEL_CHANNEL
    );
    cleanupIpcHandlers();

    ipcMain.handle(DESKTOP_UPDATES_GET_STATE_CHANNEL, async () => this.ensureCoordinator().getSnapshot());
    ipcMain.handle(DESKTOP_UPDATES_CHECK_CHANNEL, async () => await this.checkForUpdates());
    ipcMain.handle(DESKTOP_UPDATES_DOWNLOAD_CHANNEL, async () => await this.ensureCoordinator().downloadUpdate());
    ipcMain.handle(DESKTOP_UPDATES_APPLY_CHANNEL, async () => {
      const snapshot = await this.ensureCoordinator().applyDownloadedUpdate();
      this.restartApplication();
      return snapshot;
    });
    ipcMain.handle(DESKTOP_UPDATES_UPDATE_CHANNEL_CHANNEL, async (_event, channel: DesktopReleaseChannel | undefined) => {
      return await this.updateChannel(channel === "beta" ? "beta" : "stable");
    });
    this.cleanups.push(cleanupIpcHandlers);
  };

  private installApplicationMenu = (): void => {
    if (process.platform !== "darwin") {
      Menu.setApplicationMenu(null);
      return;
    }

    const snapshot = this.coordinator?.getSnapshot();
    const template: MenuItemConstructorOptions[] = [
      this.createDarwinAppMenu(snapshot),
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
      this.createHelpMenu(snapshot)
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  };

  startAutomaticChecks = async (): Promise<void> => {
    if (this.automaticCheckSchedulerStarted || this.ensureCoordinator().getSnapshot().blockReason) {
      return;
    }
    this.automaticCheckSchedulerStarted = true;
    this.cleanups.push(() => {
      this.clearAutomaticCheckTimer();
      this.automaticCheckSchedulerStarted = false;
    });
    await this.runAutomaticCheck();
  };

  private runAutomaticCheck = async (): Promise<void> => {
    try {
      await this.ensureCoordinator().runAutomaticCheck();
    } catch (error) {
      this.options.logger.warn(
        `Desktop automatic update check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.scheduleNextAutomaticCheck();
    }
  };

  private get automaticCheckIntervalMs(): number {
    return this.options.automaticCheckIntervalMs ?? AUTOMATIC_UPDATE_CHECK_INTERVAL_MS;
  }

  private scheduleNextAutomaticCheck = (): void => {
    if (!this.automaticCheckSchedulerStarted) {
      return;
    }
    this.clearAutomaticCheckTimer();
    this.automaticCheckTimer = setTimeout(this.runAutomaticCheck, this.automaticCheckIntervalMs);
  };

  private clearAutomaticCheckTimer = (): void => {
    if (this.automaticCheckTimer) {
      clearTimeout(this.automaticCheckTimer);
      this.automaticCheckTimer = null;
    }
  };

  private checkForUpdates = async (): Promise<DesktopUpdateSnapshot> => {
    try {
      return await this.ensureCoordinator().checkForUpdates({ manual: true });
    } finally {
      this.scheduleNextAutomaticCheck();
    }
  };

  private updateChannel = async (channel: DesktopReleaseChannel): Promise<DesktopUpdateSnapshot> => {
    try {
      return await this.ensureCoordinator().updateChannel(channel);
    } finally {
      this.scheduleNextAutomaticCheck();
    }
  };

  private ensureCoordinator = (): DesktopUpdateCoordinatorService => {
    if (this.coordinator) {
      return this.coordinator;
    }

    this.coordinator = new DesktopUpdateCoordinatorService({
      launcherVersion: this.options.launcherVersion,
      updateCapability: this.options.updateCapability,
      bundleManager: this.options.bundleManager,
      updateSourceService: this.options.bundleManager.updateSourceService,
      publishSnapshot: (snapshot) => {
        this.publishSnapshot(snapshot);
        this.installApplicationMenu();
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
        ...this.createUpdateMenuItems(snapshot),
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        {
          label: "Quit NextClaw",
          accelerator: "CommandOrControl+Q",
          click: () => {
            this.options.presenceService.requestExplicitQuit();
          }
        }
      ]
    };
  };

  private createHelpMenu = (snapshot: DesktopUpdateSnapshot | undefined): MenuItemConstructorOptions => {
    return {
      role: "help",
      submenu: this.createUpdateMenuItems(snapshot)
    };
  };

  private createUpdateMenuItems = (snapshot: DesktopUpdateSnapshot | undefined): MenuItemConstructorOptions[] => {
    return [
      {
        label: "Check for Updates",
        click: () => void this.handleManualUpdateCheck()
      },
      {
        label: "Download Update",
        enabled: snapshot?.status === "update-available",
        click: () => void this.handleManualUpdateDownload()
      },
      {
        label: "Restart to Apply Update",
        enabled: snapshot?.status === "downloaded",
        click: () => void this.handleApplyDownloadedUpdate()
      }
    ];
  };

  private handleManualUpdateCheck = async (): Promise<void> => {
    try {
      const snapshot = await this.checkForUpdates();
      if (snapshot.status === "up-to-date") {
        await this.showMessage("info", "NextClaw is up to date", "You already have the latest desktop bundle.");
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
      if ((snapshot.status === "blocked" || snapshot.status === "failed") && snapshot.errorMessage) {
        const title = snapshot.status === "blocked" ? "Desktop update blocked" : "Desktop update check failed";
        await this.showMessage("warning", title, snapshot.errorMessage);
      }
    } catch (error) {
      await this.showMessage("error", "Desktop update check failed", error);
    }
  };

  private handleManualUpdateDownload = async (): Promise<void> => {
    try {
      const snapshot = await this.ensureCoordinator().downloadUpdate();
      if (snapshot.status === "downloaded") {
        await this.showDownloadedUpdateDialog(snapshot);
      }
    } catch (error) {
      await this.showMessage("error", "Desktop update download failed", error);
    }
  };

  private handleApplyDownloadedUpdate = async (): Promise<void> => {
    try {
      await this.ensureCoordinator().applyDownloadedUpdate();
      this.restartApplication();
    } catch (error) {
      await this.showMessage("error", "Unable to apply desktop update", error);
    }
  };

  private showMessage = async (
    type: "info" | "warning" | "error",
    title: string,
    message: unknown
  ): Promise<void> => {
    await dialog.showMessageBox({
      type,
      title,
      message: message instanceof Error ? message.message : String(message),
      buttons: ["OK"]
    });
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
    const window = this.options.windowManager.getWindow();
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
        `downloaded=${snapshot.downloadedVersion ?? ""}`
      ].join(" ")
    );

    const window = this.options.windowManager.getWindow();
    if (!window || window.isDestroyed()) {
      return;
    }
    window.webContents.send(DESKTOP_UPDATES_STATE_CHANGED_CHANNEL, snapshot);
  };

  private restartApplication = (): void => {
    this.options.presenceService.markQuitting();
    app.relaunch();
    app.quit();
  };
}

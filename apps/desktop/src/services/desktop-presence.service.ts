import {
  Menu,
  Tray,
  app,
  ipcMain,
  nativeImage,
  type BrowserWindow,
  type Event as ElectronEvent,
  type MenuItem,
  type MenuItemConstructorOptions,
  type NativeImage
} from "electron";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DesktopLauncherStateStore } from "../launcher/stores/launcher-state.store";
import {
  DESKTOP_PRESENCE_GET_STATE_CHANNEL,
  DESKTOP_PRESENCE_UPDATE_PREFERENCES_CHANNEL
} from "../utils/desktop-ipc.utils";

type DesktopPresenceLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

type DesktopPresencePreferences = {
  closeToBackground: boolean;
  launchAtLogin: boolean;
};

export type DesktopPresenceSnapshot = DesktopPresencePreferences & {
  supportsLaunchAtLogin: boolean;
  launchAtLoginReason: string | null;
};

type DesktopPresenceServiceOptions = {
  logger: DesktopPresenceLogger;
  getWindow: () => BrowserWindow | null;
  createLauncherStateStore: () => DesktopLauncherStateStore;
  requestApplicationQuit: () => void;
};

const DEFAULT_PRESENCE_PREFERENCES: DesktopPresencePreferences = {
  closeToBackground: true,
  launchAtLogin: false
};

export class DesktopPresenceService {
  private tray: Tray | null = null;
  private quitting = false;

  constructor(private readonly options: DesktopPresenceServiceOptions) {}

  registerIpcHandlers = (): void => {
    ipcMain.removeHandler(DESKTOP_PRESENCE_GET_STATE_CHANNEL);
    ipcMain.removeHandler(DESKTOP_PRESENCE_UPDATE_PREFERENCES_CHANNEL);

    ipcMain.handle(DESKTOP_PRESENCE_GET_STATE_CHANNEL, async () => this.getSnapshot());
    ipcMain.handle(
      DESKTOP_PRESENCE_UPDATE_PREFERENCES_CHANNEL,
      async (_event, preferences: Partial<DesktopPresencePreferences> | undefined) =>
        await this.updatePreferences(preferences ?? {})
    );
  };

  installTray = (): void => {
    if (this.tray) {
      this.refreshTrayMenu();
      return;
    }

    const trayIcon = this.resolveTrayImage();
    this.tray = new Tray(trayIcon);
    this.tray.setToolTip("NextClaw");
    this.tray.on("click", this.showMainWindow);
    this.refreshTrayMenu();
  };

  handleWindowClose = (event: ElectronEvent): void => {
    if (this.quitting) {
      return;
    }
    if (!this.getSnapshot().closeToBackground) {
      return;
    }
    event.preventDefault();
    this.hideMainWindow();
    this.options.logger.info("Desktop window close intercepted. Hiding window to tray.");
  };

  handleAllWindowsClosed = (): void => {
    if (this.quitting || !this.getSnapshot().closeToBackground) {
      this.options.logger.info("All desktop windows closed. Quitting launcher.");
      this.options.requestApplicationQuit();
      return;
    }
    this.options.logger.info("All desktop windows closed. Keeping launcher alive in background.");
  };

  markQuitting = (): void => {
    this.quitting = true;
  };

  showMainWindow = (): void => {
    const window = this.options.getWindow();
    if (!window) {
      return;
    }
    if (window.isMinimized()) {
      window.restore();
    }
    if (!window.isVisible()) {
      window.show();
    }
    window.focus();
  };

  hideMainWindow = (): void => {
    this.options.getWindow()?.hide();
  };

  getSnapshot = (): DesktopPresenceSnapshot => {
    const preferences = this.readPreferences();
    const supportsLaunchAtLogin = this.supportsLaunchAtLogin();
    return {
      closeToBackground: preferences.closeToBackground,
      launchAtLogin: supportsLaunchAtLogin ? this.readLaunchAtLogin(preferences.launchAtLogin) : preferences.launchAtLogin,
      supportsLaunchAtLogin,
      launchAtLoginReason: this.getLaunchAtLoginReason()
    };
  };

  private updatePreferences = async (
    preferencesPatch: Partial<DesktopPresencePreferences>
  ): Promise<DesktopPresenceSnapshot> => {
    const nextPreferences = {
      ...this.readPreferences(),
      ...preferencesPatch
    };

    if (preferencesPatch.launchAtLogin !== undefined) {
      this.applyLaunchAtLogin(preferencesPatch.launchAtLogin);
    }

    await this.options.createLauncherStateStore().update((state) => ({
      ...state,
      presencePreferences: nextPreferences
    }));

    this.refreshTrayMenu();
    return this.getSnapshot();
  };

  private refreshTrayMenu = (): void => {
    if (!this.tray) {
      return;
    }
    const snapshot = this.getSnapshot();
    const template: MenuItemConstructorOptions[] = [
      {
        label: "Open NextClaw",
        click: this.showMainWindow
      },
      {
        label: snapshot.closeToBackground ? "Close Window Hides to Background" : "Close Window Quits App",
        enabled: false
      },
      { type: "separator" },
      {
        label: "Launch at Login",
        type: "checkbox",
        checked: snapshot.launchAtLogin,
        enabled: snapshot.supportsLaunchAtLogin,
        click: (menuItem: MenuItem) => {
          void this.handleLaunchAtLoginToggle(menuItem.checked);
        }
      },
      ...(snapshot.launchAtLoginReason
        ? [
            {
              label: snapshot.launchAtLoginReason,
              enabled: false
            } satisfies MenuItemConstructorOptions
          ]
        : []),
      { type: "separator" },
      {
        label: "Quit NextClaw",
        click: () => {
          this.options.requestApplicationQuit();
        }
      }
    ];
    this.tray.setContextMenu(Menu.buildFromTemplate(template));
  };

  private handleLaunchAtLoginToggle = async (checked: boolean): Promise<void> => {
    try {
      await this.updatePreferences({
        launchAtLogin: checked
      });
    } catch (error) {
      this.options.logger.error(`Failed to update launch-at-login setting from tray: ${String(error)}`);
    }
  };

  private readPreferences = (): DesktopPresencePreferences => {
    const state = this.options.createLauncherStateStore().read();
    return state.presencePreferences ?? { ...DEFAULT_PRESENCE_PREFERENCES };
  };

  private supportsLaunchAtLogin = (): boolean => {
    if (!app.isPackaged) {
      return false;
    }
    return process.platform === "darwin" || process.platform === "win32";
  };

  private getLaunchAtLoginReason = (): string | null => {
    if (this.supportsLaunchAtLogin()) {
      return null;
    }
    if (!app.isPackaged) {
      return "Launch at login is available in packaged desktop builds.";
    }
    return "Launch at login currently supports macOS and Windows desktop builds.";
  };

  private applyLaunchAtLogin = (enabled: boolean): void => {
    if (!this.supportsLaunchAtLogin()) {
      return;
    }
    if (process.platform === "darwin") {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true
      });
      return;
    }
    app.setLoginItemSettings({
      openAtLogin: enabled
    });
  };

  private readLaunchAtLogin = (fallback: boolean): boolean => {
    if (!this.supportsLaunchAtLogin()) {
      return fallback;
    }
    try {
      return app.getLoginItemSettings().openAtLogin;
    } catch (error) {
      this.options.logger.warn(`Failed to read launch-at-login state. Falling back to stored preference: ${String(error)}`);
      return fallback;
    }
  };

  private resolveTrayImage = (): NativeImage => {
    const candidatePaths = [
      resolve(app.getAppPath(), "build", "icons", "icon.png"),
      join(process.resourcesPath, "app.asar", "build", "icons", "icon.png"),
      join(process.resourcesPath, "build", "icons", "icon.png")
    ];

    for (const candidatePath of candidatePaths) {
      if (!existsSync(candidatePath)) {
        continue;
      }
      const image = nativeImage.createFromPath(candidatePath);
      if (!image.isEmpty()) {
        return image.resize({ width: 18, height: 18 });
      }
    }

    this.options.logger.warn("Tray icon could not be resolved. Falling back to an empty image.");
    return nativeImage.createEmpty();
  };
}

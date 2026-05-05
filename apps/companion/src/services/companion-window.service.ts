import { app, BrowserWindow, ipcMain, shell } from "electron";
import type { CompanionAvatarView } from "../types/companion.types.js";
import type { CompanionWindowPositionStore } from "../stores/companion-window-position.store.js";
import { renderCompanionHtml } from "../utils/companion-renderer-html.utils.js";

export class CompanionWindowService {
  private window: BrowserWindow | null = null;
  private currentView: CompanionAvatarView | null = null;

  constructor(
    private readonly preloadPath: string,
    private readonly positionStore: CompanionWindowPositionStore
  ) {}

  readonly create = async (): Promise<void> => {
    if (this.window) {
      return;
    }

    const bounds = this.positionStore.read();
    this.window = new BrowserWindow({
      width: 112,
      height: 132,
      x: bounds?.x,
      y: bounds?.y,
      frame: false,
      transparent: true,
      resizable: false,
      movable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    this.window.on("close", () => {
      this.persistBounds();
    });
    this.window.on("move", () => {
      this.persistBounds();
    });
    this.window.on("moved", () => {
      this.persistBounds();
    });
    this.window.on("closed", () => {
      this.window = null;
    });

    ipcMain.removeHandler("companion:open");
    ipcMain.handle("companion:open", async () => {
      const openUrl = this.currentView?.openUrl;
      if (openUrl) {
        await shell.openExternal(openUrl);
      }
      return null;
    });
    ipcMain.removeHandler("companion:quit");
    ipcMain.handle("companion:quit", async () => {
      app.quit();
      return null;
    });

    ipcMain.removeAllListeners("companion:ready");
    ipcMain.on("companion:ready", () => {
      if (this.currentView) {
        this.window?.webContents.send("companion:view", this.currentView);
      }
    });

    await this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderCompanionHtml())}`);
  };

  readonly show = (): void => {
    this.window?.showInactive();
  };

  readonly toggleVisibility = (): void => {
    if (!this.window) {
      return;
    }
    if (this.window.isVisible()) {
      this.window.hide();
      return;
    }
    this.window.showInactive();
  };

  readonly updateView = (view: CompanionAvatarView): void => {
    this.currentView = view;
    this.window?.webContents.send("companion:view", view);
  };

  readonly destroy = (): void => {
    ipcMain.removeHandler("companion:open");
    ipcMain.removeHandler("companion:quit");
    ipcMain.removeAllListeners("companion:ready");
    this.window?.destroy();
    this.window = null;
  };

  private readonly persistBounds = (): void => {
    const bounds = this.window?.getBounds();
    if (!bounds) {
      return;
    }
    this.positionStore.write({
      x: bounds.x,
      y: bounds.y
    });
  };
}

import { BrowserWindow, ipcMain, shell } from "electron";

import type { CompanionShellBootstrap } from "../types/companion-shell.types.js";
import type { CompanionWindowPositionPersistenceService } from "./companion-window-position-persistence.service.js";

export class CompanionWindowService {
  private window: BrowserWindow | null = null;

  constructor(private readonly options: {
    preloadPath: string;
    rendererEntryPath: string;
    positionPersistenceService: CompanionWindowPositionPersistenceService;
    baseUrl: string;
    onQuit: () => void;
  }) {}

  readonly create = async (): Promise<void> => {
    if (this.window) {
      return;
    }

    const bounds = this.options.positionPersistenceService.read();
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
        preload: this.options.preloadPath,
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
      await shell.openExternal(this.options.baseUrl);
      return null;
    });
    ipcMain.removeHandler("companion:quit");
    ipcMain.handle("companion:quit", async () => {
      this.options.onQuit();
      return null;
    });
    ipcMain.removeHandler("companion:get-bootstrap");
    ipcMain.handle("companion:get-bootstrap", async (): Promise<CompanionShellBootstrap> => {
      return {
        baseUrl: this.options.baseUrl
      };
    });

    await this.window.loadFile(this.options.rendererEntryPath);
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

  readonly destroy = (): void => {
    ipcMain.removeHandler("companion:open");
    ipcMain.removeHandler("companion:quit");
    ipcMain.removeHandler("companion:get-bootstrap");
    this.window?.destroy();
    this.window = null;
  };

  private readonly persistBounds = (): void => {
    const bounds = this.window?.getBounds();
    if (!bounds) {
      return;
    }
    this.options.positionPersistenceService.write({
      x: bounds.x,
      y: bounds.y
    });
  };
}

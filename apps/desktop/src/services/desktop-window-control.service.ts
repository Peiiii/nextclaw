import { BrowserWindow, ipcMain } from "electron";
import {
  DESKTOP_WINDOW_CONTROL_CHANNEL,
  DESKTOP_WINDOW_STATE_CHANGED_CHANNEL,
  DESKTOP_WINDOW_STATE_GET_CHANNEL
} from "../utils/desktop-ipc.utils";

export type DesktopWindowControlAction = "minimize" | "toggle-maximize" | "close";
export type DesktopWindowStateSnapshot = { isMaximized: boolean };

export class DesktopWindowControlService {
  registerIpcHandlers = (): void => {
    ipcMain.removeHandler(DESKTOP_WINDOW_CONTROL_CHANNEL);
    ipcMain.removeHandler(DESKTOP_WINDOW_STATE_GET_CHANNEL);
    ipcMain.handle(DESKTOP_WINDOW_CONTROL_CHANNEL, (event, action: unknown) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window || !isDesktopWindowControlAction(action)) {
        return;
      }
      this.applyWindowAction(window, action);
    });
    ipcMain.handle(DESKTOP_WINDOW_STATE_GET_CHANNEL, (event): DesktopWindowStateSnapshot => {
      const window = BrowserWindow.fromWebContents(event.sender);
      return this.createWindowStateSnapshot(window);
    });
  };

  attachWindow = (window: BrowserWindow): void => {
    const emitWindowState = () => {
      this.emitWindowState(window);
    };

    window.on("maximize", emitWindowState);
    window.on("unmaximize", emitWindowState);
    window.on("closed", () => {
      window.removeListener("maximize", emitWindowState);
      window.removeListener("unmaximize", emitWindowState);
    });
  };

  private applyWindowAction = (window: BrowserWindow, action: DesktopWindowControlAction): void => {
    if (action === "minimize") {
      window.minimize();
      return;
    }
    if (action === "toggle-maximize") {
      if (window.isMaximized()) {
        window.unmaximize();
        this.emitWindowState(window);
        return;
      }
      window.maximize();
      this.emitWindowState(window);
      return;
    }
    window.close();
  };

  private createWindowStateSnapshot = (window: BrowserWindow | null): DesktopWindowStateSnapshot => ({
    isMaximized: Boolean(window && !window.isDestroyed() && window.isMaximized())
  });

  private emitWindowState = (window: BrowserWindow): void => {
    if (window.isDestroyed()) {
      return;
    }
    window.webContents.send(DESKTOP_WINDOW_STATE_CHANGED_CHANNEL, this.createWindowStateSnapshot(window));
  };
}

function isDesktopWindowControlAction(value: unknown): value is DesktopWindowControlAction {
  return value === "minimize" || value === "toggle-maximize" || value === "close";
}

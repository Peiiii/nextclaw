import { BrowserWindow, ipcMain } from "electron";
import { DESKTOP_WINDOW_CONTROL_CHANNEL } from "../utils/desktop-ipc.utils";

export type DesktopWindowControlAction = "minimize" | "toggle-maximize" | "close";

export class DesktopWindowControlService {
  registerIpcHandlers = (): void => {
    ipcMain.removeHandler(DESKTOP_WINDOW_CONTROL_CHANNEL);
    ipcMain.handle(DESKTOP_WINDOW_CONTROL_CHANNEL, (event, action: unknown) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window || !isDesktopWindowControlAction(action)) {
        return;
      }
      this.applyWindowAction(window, action);
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
        return;
      }
      window.maximize();
      return;
    }
    window.close();
  };
}

function isDesktopWindowControlAction(value: unknown): value is DesktopWindowControlAction {
  return value === "minimize" || value === "toggle-maximize" || value === "close";
}

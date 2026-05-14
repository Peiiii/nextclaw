import { ipcMain, type BrowserWindow } from "electron";
import { DESKTOP_SHELL_THEME_SET_CHANNEL } from "../utils/desktop-ipc.utils";
import {
  createDesktopTitleBarOverlay,
  isDesktopShellTheme
} from "../utils/desktop-window-options.utils";

type DesktopShellThemeServiceOptions = {
  getWindow: () => BrowserWindow | null;
};

export class DesktopShellThemeService {
  constructor(private readonly options: DesktopShellThemeServiceOptions) {}

  registerIpcHandlers = (): void => {
    ipcMain.removeHandler(DESKTOP_SHELL_THEME_SET_CHANNEL);
    ipcMain.handle(DESKTOP_SHELL_THEME_SET_CHANNEL, (_event, theme: unknown) => {
      if (!isDesktopShellTheme(theme) || process.platform !== "win32") {
        return;
      }
      this.options.getWindow()?.setTitleBarOverlay(createDesktopTitleBarOverlay(theme));
    });
  };
}

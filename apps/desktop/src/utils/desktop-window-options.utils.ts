import type { BrowserWindowConstructorOptions } from "electron";

const desktopWindowWidth = 1360;
const desktopWindowHeight = 920;
const desktopWindowMinWidth = 420;
const desktopWindowMinHeight = 320;
const windowsShellBackgroundColor = "#F2F1EE";

export function createDesktopWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    width: desktopWindowWidth,
    height: desktopWindowHeight,
    minWidth: desktopWindowMinWidth,
    minHeight: desktopWindowMinHeight,
    ...createPlatformWindowChromeOptions(),
    title: "NextClaw Desktop",
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  };
}

function createPlatformWindowChromeOptions(): BrowserWindowConstructorOptions {
  if (process.platform === "win32") {
    return {
      autoHideMenuBar: true,
      backgroundColor: windowsShellBackgroundColor,
      frame: false
    };
  }
  if (process.platform === "darwin") {
    return {
      titleBarStyle: "hiddenInset"
    };
  }
  return {
    autoHideMenuBar: true
  };
}

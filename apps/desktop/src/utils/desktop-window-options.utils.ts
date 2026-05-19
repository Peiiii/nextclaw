import type { BrowserWindowConstructorOptions, TitleBarOverlay } from "electron";

export type DesktopShellTheme = "warm" | "cool";

const desktopWindowWidth = 1360;
const desktopWindowHeight = 920;
const desktopWindowMinWidth = 1080;
const desktopWindowMinHeight = 720;
const windowsTitleBarHeight = 40;
const windowsShellBackgroundColor = "#F2F1EE";
const desktopTitleBarThemes: Record<DesktopShellTheme, Required<TitleBarOverlay>> = {
  warm: {
    color: windowsShellBackgroundColor,
    symbolColor: "#33332F",
    height: windowsTitleBarHeight
  },
  cool: {
    color: "#F3F4F6",
    symbolColor: "#374151",
    height: windowsTitleBarHeight
  }
};

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
      titleBarStyle: "hidden",
      titleBarOverlay: {
        ...createDesktopTitleBarOverlay("warm")
      }
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

export function isDesktopShellTheme(value: unknown): value is DesktopShellTheme {
  return value === "warm" || value === "cool";
}

export function createDesktopTitleBarOverlay(theme: DesktopShellTheme): TitleBarOverlay {
  return desktopTitleBarThemes[theme];
}

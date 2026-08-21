import { isAbsolute } from "node:path";
import type { WebContents } from "electron";
import {
  DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL,
  DESKTOP_HOST_REVEAL_PATH_CHANNEL
} from "../utils/desktop-ipc.utils";

export type DesktopOpenExternalUrlResult =
  | { opened: true }
  | { opened: false; reason: "unsupported-url" | "bridge-failed" };

export type DesktopRevealPathResult =
  | { revealed: true }
  | { revealed: false; reason: "unsupported-path" | "bridge-failed" };

type DesktopHostIpcMain = {
  handle: (
    channel: string,
    listener: (
      event: unknown,
      ...args: unknown[]
    ) => Promise<DesktopOpenExternalUrlResult | DesktopRevealPathResult>
  ) => void;
  removeHandler: (channel: string) => void;
};

type DesktopHostShell = {
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (path: string) => void;
};

type DesktopHostCapabilityServiceOptions = {
  ipcMain: DesktopHostIpcMain;
  shell: DesktopHostShell;
};

export class DesktopHostCapabilityService {
  constructor(private readonly options: DesktopHostCapabilityServiceOptions) {}

  start = (): void => {
    this.dispose();
    this.options.ipcMain.handle(
      DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL,
      (_event, rawUrl) => this.openExternalUrl(rawUrl)
    );
    this.options.ipcMain.handle(
      DESKTOP_HOST_REVEAL_PATH_CHANNEL,
      this.handleRevealPath
    );
  };

  dispose = (): void => {
    this.options.ipcMain.removeHandler(DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL);
    this.options.ipcMain.removeHandler(DESKTOP_HOST_REVEAL_PATH_CHANNEL);
  };

  attachExternalNavigation = (
    webContents: WebContents,
    isAllowedInAppNavigation: (url: string) => boolean
  ): void => {
    webContents.setWindowOpenHandler(({ url }) => {
      setImmediate(() => {
        void this.openExternalUrl(url);
      });
      return { action: "deny" };
    });
    webContents.on("will-navigate", (event) => {
      if (isAllowedInAppNavigation(event.url)) {
        return;
      }
      event.preventDefault();
      void this.openExternalUrl(event.url);
    });
  };

  openExternalUrl = async (rawUrl: unknown): Promise<DesktopOpenExternalUrlResult> => {
    if (typeof rawUrl !== "string") {
      return { opened: false, reason: "unsupported-url" };
    }

    const url = normalizeExternalHttpUrl(rawUrl);
    if (!url) {
      return { opened: false, reason: "unsupported-url" };
    }

    try {
      await this.options.shell.openExternal(url);
      return { opened: true };
    } catch {
      return { opened: false, reason: "bridge-failed" };
    }
  };

  private handleRevealPath = async (
    _event: unknown,
    rawPath: unknown
  ): Promise<DesktopRevealPathResult> => {
    const path = normalizeAbsolutePath(rawPath);
    if (!path) {
      return { revealed: false, reason: "unsupported-path" };
    }
    try {
      this.options.shell.showItemInFolder(path);
      return { revealed: true };
    } catch {
      return { revealed: false, reason: "bridge-failed" };
    }
  };
}

function normalizeAbsolutePath(rawPath: unknown): string | null {
  if (typeof rawPath !== "string") {
    return null;
  }
  const path = rawPath.trim();
  return path && isAbsolute(path) ? path : null;
}

function normalizeExternalHttpUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

import { DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL } from "../utils/desktop-ipc.utils";

export type DesktopOpenExternalUrlResult =
  | { opened: true }
  | { opened: false; reason: "unsupported-url" | "bridge-failed" };

type DesktopHostIpcMain = {
  handle: (
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => Promise<DesktopOpenExternalUrlResult>
  ) => void;
  removeHandler: (channel: string) => void;
};

type DesktopHostShell = {
  openExternal: (url: string) => Promise<void>;
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
      this.handleOpenExternalUrl
    );
  };

  dispose = (): void => {
    this.options.ipcMain.removeHandler(DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL);
  };

  private handleOpenExternalUrl = async (
    _event: unknown,
    rawUrl: unknown
  ): Promise<DesktopOpenExternalUrlResult> => {
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

export type OpenExternalUrlFailureReason =
  | "unsupported-url"
  | "popup-blocked"
  | "bridge-failed";

export type OpenExternalUrlResult =
  | { opened: true }
  | { opened: false; reason: OpenExternalUrlFailureReason };

export type RevealPathResult =
  | { revealed: true }
  | {
      revealed: false;
      reason: "unsupported-path" | "host-unavailable" | "bridge-failed";
    };

type HostWindow = Pick<Window, "open"> & {
  nextclawDesktop?: {
    host?: {
      openExternalUrl?: (url: string) => Promise<OpenExternalUrlResult>;
      revealPath?: (path: string) => Promise<RevealPathResult>;
    };
  };
};

export class HostCapabilityManager {
  constructor(private readonly getWindow = (): HostWindow | null => {
    return typeof window === "undefined" ? null : window;
  }) {}

  openExternalUrl = async (rawUrl: string): Promise<OpenExternalUrlResult> => {
    const url = normalizeExternalHttpUrl(rawUrl);
    if (!url) {
      return { opened: false, reason: "unsupported-url" };
    }

    const hostWindow = this.getWindow();
    if (!hostWindow) {
      return { opened: false, reason: "bridge-failed" };
    }

    try {
      const desktopOpen = hostWindow.nextclawDesktop?.host?.openExternalUrl;
      if (desktopOpen) {
        return await desktopOpen(url);
      }
      const openedWindow = hostWindow.open(url, "_blank", "noopener,noreferrer");
      if (!openedWindow) {
        return { opened: false, reason: "popup-blocked" };
      }
      return { opened: true };
    } catch {
      return { opened: false, reason: "bridge-failed" };
    }
  };

  canRevealPath = (): boolean => {
    return Boolean(this.getWindow()?.nextclawDesktop?.host?.revealPath);
  };

  revealPath = async (rawPath: string): Promise<RevealPathResult> => {
    const path = rawPath.trim();
    if (!path) {
      return { revealed: false, reason: "unsupported-path" };
    }
    const revealPath = this.getWindow()?.nextclawDesktop?.host?.revealPath;
    if (!revealPath) {
      return { revealed: false, reason: "host-unavailable" };
    }
    try {
      return await revealPath(path);
    } catch {
      return { revealed: false, reason: "bridge-failed" };
    }
  };
}

export const hostCapabilityManager = new HostCapabilityManager();

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

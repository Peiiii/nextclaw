export type DesktopHostPlatform = string | null;

const devPlatformOverrideParam = "nextclawDesktopPlatform";
const devPlatformOverrideStorageKey = "nextclaw.desktopPlatformOverride";

export function getDesktopHostPlatform(): DesktopHostPlatform {
  if (typeof window === "undefined") {
    return null;
  }
  return getDevDesktopHostPlatformOverride() ?? window.nextclawDesktop?.platform ?? null;
}

export function isMacDesktopHost(): boolean {
  return getDesktopHostPlatform() === "darwin";
}

export function isWindowsDesktopHost(): boolean {
  return getDesktopHostPlatform() === "win32";
}

function getDevDesktopHostPlatformOverride(): DesktopHostPlatform {
  if (!import.meta.env.DEV) {
    return null;
  }
  const platform = new URLSearchParams(window.location.search).get(devPlatformOverrideParam);
  if (platform === "win32" || platform === "darwin") {
    writeDevDesktopHostPlatformOverride(platform);
    return platform;
  }
  if (platform === "clear") {
    writeDevDesktopHostPlatformOverride(null);
    return null;
  }
  return readDevDesktopHostPlatformOverride();
}

function readDevDesktopHostPlatformOverride(): DesktopHostPlatform {
  try {
    const platform = window.sessionStorage.getItem(devPlatformOverrideStorageKey);
    return platform === "win32" || platform === "darwin" ? platform : null;
  } catch {
    return null;
  }
}

function writeDevDesktopHostPlatformOverride(platform: DesktopHostPlatform): void {
  try {
    if (platform) {
      window.sessionStorage.setItem(devPlatformOverrideStorageKey, platform);
      return;
    }
    window.sessionStorage.removeItem(devPlatformOverrideStorageKey);
  } catch {
    // Storage can be unavailable in restricted browser contexts; URL-only override still works.
  }
}

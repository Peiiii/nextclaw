import type { App } from "electron";
import type { DesktopInstallationProfile } from "./desktop-installation-profile.utils";
import {
  applyDesktopInstallationProfile,
  resolveDesktopInstallationProfile
} from "./desktop-installation-profile.utils";
import { resolveDesktopDataDir, resolveDesktopRuntimeHome } from "./desktop-paths.utils";

export function setupDesktopInstallationProfile(app: Pick<App, "getPath" | "setPath">): DesktopInstallationProfile {
  const profile = resolveDesktopInstallationProfile({
    execPath: process.execPath,
    argv: process.argv,
    env: process.env,
    defaultDesktopDataDir: resolveDesktopDataDir(),
    defaultUserDataDir: app.getPath("userData"),
    defaultLogsDir: app.getPath("logs"),
    defaultRuntimeHome: resolveDesktopRuntimeHome()
  });
  applyDesktopInstallationProfile(app, profile);
  Object.assign(process.env, profile.runtimeEnvPatch);
  return profile;
}

import { contextBridge, ipcRenderer } from "electron";
import type { DesktopUpdateSnapshot } from "./launcher/services/update-coordinator.service";
import type { DesktopUiLanguagePreference } from "./launcher/stores/launcher-state.store";
import type { DesktopReleaseChannel } from "./launcher/stores/launcher-state.store";
import {
  DESKTOP_PRESENCE_GET_STATE_CHANNEL,
  DESKTOP_PRESENCE_UPDATE_PREFERENCES_CHANNEL,
  DESKTOP_LOCALE_GET_CHANNEL,
  DESKTOP_LOCALE_SET_CHANNEL,
  DESKTOP_RUNTIME_RESTART_APP_CHANNEL,
  DESKTOP_RUNTIME_RESTART_SERVICE_CHANNEL,
  DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL,
  DESKTOP_WINDOW_CONTROL_CHANNEL,
  DESKTOP_WINDOW_STATE_CHANGED_CHANNEL,
  DESKTOP_WINDOW_STATE_GET_CHANNEL,
  DESKTOP_UPDATES_APPLY_CHANNEL,
  DESKTOP_UPDATES_CHECK_CHANNEL,
  DESKTOP_UPDATES_DOWNLOAD_CHANNEL,
  DESKTOP_UPDATES_GET_STATE_CHANNEL,
  DESKTOP_UPDATES_STATE_CHANGED_CHANNEL,
  DESKTOP_UPDATES_UPDATE_CHANNEL_CHANNEL
} from "./utils/desktop-ipc.utils";

type DesktopRuntimeControlResult = {
  accepted: boolean;
  action: "restart-service" | "restart-app";
  lifecycle: "restarting-service" | "restarting-app";
  message: string;
};

type DesktopPresencePreferences = {
  closeToBackground: boolean;
  launchAtLogin: boolean;
};

type DesktopPresenceSnapshot = DesktopPresencePreferences & {
  supportsLaunchAtLogin: boolean;
  launchAtLoginReason: string | null;
};

type DesktopWindowControlAction = "minimize" | "toggle-maximize" | "close";
type DesktopWindowStateSnapshot = {
  isMaximized: boolean;
};
type DesktopOpenExternalUrlResult =
  | { opened: true }
  | { opened: false; reason: "unsupported-url" | "popup-blocked" | "bridge-failed" };

contextBridge.exposeInMainWorld("nextclawDesktop", {
  platform: process.platform,
  version: process.versions.electron,
  localePreference: ipcRenderer.sendSync(DESKTOP_LOCALE_GET_CHANNEL) as DesktopUiLanguagePreference | null,
  getUpdateState: async (): Promise<DesktopUpdateSnapshot> => await ipcRenderer.invoke(DESKTOP_UPDATES_GET_STATE_CHANNEL),
  checkForUpdates: async (): Promise<DesktopUpdateSnapshot> => await ipcRenderer.invoke(DESKTOP_UPDATES_CHECK_CHANNEL),
  downloadUpdate: async (): Promise<DesktopUpdateSnapshot> => await ipcRenderer.invoke(DESKTOP_UPDATES_DOWNLOAD_CHANNEL),
  applyDownloadedUpdate: async (): Promise<DesktopUpdateSnapshot> =>
    await ipcRenderer.invoke(DESKTOP_UPDATES_APPLY_CHANNEL),
  updateChannel: async (channel: DesktopReleaseChannel): Promise<DesktopUpdateSnapshot> =>
    await ipcRenderer.invoke(DESKTOP_UPDATES_UPDATE_CHANNEL_CHANNEL, channel),
  restartService: async (): Promise<DesktopRuntimeControlResult> =>
    await ipcRenderer.invoke(DESKTOP_RUNTIME_RESTART_SERVICE_CHANNEL),
  restartApp: async (): Promise<DesktopRuntimeControlResult> =>
    await ipcRenderer.invoke(DESKTOP_RUNTIME_RESTART_APP_CHANNEL),
  getPresenceState: async (): Promise<DesktopPresenceSnapshot> =>
    await ipcRenderer.invoke(DESKTOP_PRESENCE_GET_STATE_CHANNEL),
  updatePresencePreferences: async (preferences: Partial<DesktopPresencePreferences>): Promise<DesktopPresenceSnapshot> =>
    await ipcRenderer.invoke(DESKTOP_PRESENCE_UPDATE_PREFERENCES_CHANNEL, preferences),
  setLocalePreference: async (language: DesktopUiLanguagePreference | null): Promise<DesktopUiLanguagePreference | null> =>
    await ipcRenderer.invoke(DESKTOP_LOCALE_SET_CHANNEL, language),
  getWindowState: async (): Promise<DesktopWindowStateSnapshot> =>
    await ipcRenderer.invoke(DESKTOP_WINDOW_STATE_GET_CHANNEL),
  controlWindow: async (action: DesktopWindowControlAction): Promise<void> => {
    await ipcRenderer.invoke(DESKTOP_WINDOW_CONTROL_CHANNEL, action);
  },
  host: {
    openExternalUrl: async (url: string): Promise<DesktopOpenExternalUrlResult> =>
      await ipcRenderer.invoke(DESKTOP_HOST_OPEN_EXTERNAL_URL_CHANNEL, url)
  },
  onWindowStateChanged: (listener: (snapshot: DesktopWindowStateSnapshot) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: DesktopWindowStateSnapshot) => {
      listener(snapshot);
    };
    ipcRenderer.on(DESKTOP_WINDOW_STATE_CHANGED_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(DESKTOP_WINDOW_STATE_CHANGED_CHANNEL, handler);
    };
  },
  onUpdateStateChanged: (listener: (snapshot: DesktopUpdateSnapshot) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: DesktopUpdateSnapshot) => {
      listener(snapshot);
    };
    ipcRenderer.on(DESKTOP_UPDATES_STATE_CHANGED_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(DESKTOP_UPDATES_STATE_CHANGED_CHANNEL, handler);
    };
  }
});

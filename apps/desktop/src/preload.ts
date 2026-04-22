import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopUpdatePreferences,
  DesktopUpdateSnapshot
} from "./launcher/services/update-coordinator.service";
import type { DesktopUiLanguagePreference } from "./launcher/stores/launcher-state.store";
import type { DesktopReleaseChannel } from "./launcher/stores/launcher-state.store";
import {
  DESKTOP_PRESENCE_GET_STATE_CHANNEL,
  DESKTOP_PRESENCE_UPDATE_PREFERENCES_CHANNEL,
  DESKTOP_LOCALE_GET_CHANNEL,
  DESKTOP_LOCALE_SET_CHANNEL,
  DESKTOP_RUNTIME_RESTART_APP_CHANNEL,
  DESKTOP_RUNTIME_RESTART_SERVICE_CHANNEL,
  DESKTOP_UPDATES_APPLY_CHANNEL,
  DESKTOP_UPDATES_CHECK_CHANNEL,
  DESKTOP_UPDATES_DOWNLOAD_CHANNEL,
  DESKTOP_UPDATES_GET_STATE_CHANNEL,
  DESKTOP_UPDATES_STATE_CHANGED_CHANNEL,
  DESKTOP_UPDATES_UPDATE_CHANNEL_CHANNEL,
  DESKTOP_UPDATES_UPDATE_PREFERENCES_CHANNEL
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

contextBridge.exposeInMainWorld("nextclawDesktop", {
  platform: process.platform,
  version: process.versions.electron,
  localePreference: ipcRenderer.sendSync(DESKTOP_LOCALE_GET_CHANNEL) as DesktopUiLanguagePreference | null,
  getUpdateState: async (): Promise<DesktopUpdateSnapshot> => await ipcRenderer.invoke(DESKTOP_UPDATES_GET_STATE_CHANNEL),
  checkForUpdates: async (): Promise<DesktopUpdateSnapshot> => await ipcRenderer.invoke(DESKTOP_UPDATES_CHECK_CHANNEL),
  downloadUpdate: async (): Promise<DesktopUpdateSnapshot> => await ipcRenderer.invoke(DESKTOP_UPDATES_DOWNLOAD_CHANNEL),
  applyDownloadedUpdate: async (): Promise<DesktopUpdateSnapshot> =>
    await ipcRenderer.invoke(DESKTOP_UPDATES_APPLY_CHANNEL),
  updatePreferences: async (preferences: Partial<DesktopUpdatePreferences>): Promise<DesktopUpdateSnapshot> =>
    await ipcRenderer.invoke(DESKTOP_UPDATES_UPDATE_PREFERENCES_CHANNEL, preferences),
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

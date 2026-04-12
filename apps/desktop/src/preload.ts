import { contextBridge, ipcRenderer } from "electron";
import type { DesktopUpdatePreferences, DesktopUpdateSnapshot } from "./launcher/services/update-coordinator.service";

const DESKTOP_UPDATES_GET_STATE_CHANNEL = "nextclaw-desktop:updates:get-state";
const DESKTOP_UPDATES_CHECK_CHANNEL = "nextclaw-desktop:updates:check";
const DESKTOP_UPDATES_DOWNLOAD_CHANNEL = "nextclaw-desktop:updates:download";
const DESKTOP_UPDATES_APPLY_CHANNEL = "nextclaw-desktop:updates:apply";
const DESKTOP_UPDATES_UPDATE_PREFERENCES_CHANNEL = "nextclaw-desktop:updates:update-preferences";
const DESKTOP_UPDATES_STATE_CHANGED_CHANNEL = "nextclaw-desktop:updates:state-changed";

contextBridge.exposeInMainWorld("nextclawDesktop", {
  platform: process.platform,
  version: process.versions.electron,
  getUpdateState: async (): Promise<DesktopUpdateSnapshot> => await ipcRenderer.invoke(DESKTOP_UPDATES_GET_STATE_CHANNEL),
  checkForUpdates: async (): Promise<DesktopUpdateSnapshot> => await ipcRenderer.invoke(DESKTOP_UPDATES_CHECK_CHANNEL),
  downloadUpdate: async (): Promise<DesktopUpdateSnapshot> => await ipcRenderer.invoke(DESKTOP_UPDATES_DOWNLOAD_CHANNEL),
  applyDownloadedUpdate: async (): Promise<DesktopUpdateSnapshot> =>
    await ipcRenderer.invoke(DESKTOP_UPDATES_APPLY_CHANNEL),
  updatePreferences: async (preferences: Partial<DesktopUpdatePreferences>): Promise<DesktopUpdateSnapshot> =>
    await ipcRenderer.invoke(DESKTOP_UPDATES_UPDATE_PREFERENCES_CHANNEL, preferences),
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

import { ipcMain } from "electron";

export type DesktopCleanup = () => void;

export function drainDesktopCleanups(cleanups: DesktopCleanup[]): void {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
}

export function removeDesktopIpcHandlers(...channels: string[]): DesktopCleanup {
  return () => {
    for (const channel of channels) {
      ipcMain.removeHandler(channel);
    }
  };
}

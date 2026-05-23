import { BrowserWindow, ipcMain, type Event as ElectronEvent } from "electron";
import { join } from "node:path";
import type { DesktopLogger } from "../utils/desktop-logging.utils";
import { createDesktopWindowOptions } from "../utils/desktop-window-options.utils";
import { attachWindowDiagnostics } from "../utils/window-diagnostics.utils";
import {
  DESKTOP_WINDOW_CONTROL_CHANNEL,
  DESKTOP_WINDOW_STATE_CHANGED_CHANNEL,
  DESKTOP_WINDOW_STATE_GET_CHANNEL
} from "../utils/desktop-ipc.utils";
import {
  drainDesktopCleanups,
  removeDesktopIpcHandlers,
  type DesktopCleanup
} from "../utils/desktop-lifecycle.utils";

type DesktopWindowControlAction = "minimize" | "toggle-maximize" | "close";
type DesktopWindowStateSnapshot = { isMaximized: boolean };

type DesktopWindowManagerOptions = {
  logger: DesktopLogger;
  compiledMainDir: string;
  handleWindowClose: (event: ElectronEvent) => void;
};

export class DesktopWindowManager {
  private readonly cleanups: DesktopCleanup[] = [];
  private window: BrowserWindow | null = null;
  private runtimeWindowUrl: string | null = null;

  constructor(private readonly options: DesktopWindowManagerOptions) {}

  start = (): void => {
    this.dispose();
    ipcMain.removeHandler(DESKTOP_WINDOW_CONTROL_CHANNEL);
    ipcMain.removeHandler(DESKTOP_WINDOW_STATE_GET_CHANNEL);
    ipcMain.handle(DESKTOP_WINDOW_CONTROL_CHANNEL, (event, action: unknown) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window || !isDesktopWindowControlAction(action)) {
        return;
      }
      this.applyWindowAction(window, action);
    });
    ipcMain.handle(DESKTOP_WINDOW_STATE_GET_CHANNEL, (event): DesktopWindowStateSnapshot => {
      return this.createWindowStateSnapshot(BrowserWindow.fromWebContents(event.sender));
    });
    this.cleanups.push(removeDesktopIpcHandlers(DESKTOP_WINDOW_CONTROL_CHANNEL, DESKTOP_WINDOW_STATE_GET_CHANNEL));
  };

  dispose = (): void => {
    drainDesktopCleanups(this.cleanups);
  };

  getWindow = (): BrowserWindow | null => this.window;

  hasRuntimeWindowUrl = (): boolean => Boolean(this.runtimeWindowUrl);

  clearRuntimeWindowUrl = (): void => {
    this.runtimeWindowUrl = null;
  };

  showMainWindow = (): void => {
    const window = this.window;
    if (!window) {
      return;
    }
    if (window.isMinimized()) {
      window.restore();
    }
    if (!window.isVisible()) {
      window.show();
    }
    window.focus();
  };

  hideMainWindow = (): void => {
    this.window?.hide();
  };

  loadRuntimeWindow = async (runtimeWindowUrl: string): Promise<void> => {
    this.runtimeWindowUrl = runtimeWindowUrl;
    const window = this.ensureWindow();
    this.options.logger.info(`Loading desktop window URL: ${runtimeWindowUrl}`);
    await window.loadURL(runtimeWindowUrl);
  };

  restoreRuntimeWindow = async (): Promise<void> => {
    if (this.window || !this.runtimeWindowUrl) {
      return;
    }
    await this.loadRuntimeWindow(this.runtimeWindowUrl);
  };

  loadTextWindow = async (text: string): Promise<void> => {
    await this.ensureWindow().loadURL(`data:text/plain,${encodeURIComponent(text)}`);
  };

  private ensureWindow = (): BrowserWindow => {
    if (this.window) {
      return this.window;
    }
    const window = new BrowserWindow(createDesktopWindowOptions(join(this.options.compiledMainDir, "preload.js")));
    this.attachWindow(window);
    attachWindowDiagnostics(window, this.options.logger);
    window.on("close", this.options.handleWindowClose);
    window.on("closed", () => {
      this.window = null;
    });
    this.window = window;
    return window;
  };

  private attachWindow = (window: BrowserWindow): void => {
    const emitWindowState = () => {
      this.emitWindowState(window);
    };

    window.on("maximize", emitWindowState);
    window.on("unmaximize", emitWindowState);
    window.on("closed", () => {
      window.removeListener("maximize", emitWindowState);
      window.removeListener("unmaximize", emitWindowState);
    });
  };

  private applyWindowAction = (window: BrowserWindow, action: DesktopWindowControlAction): void => {
    if (action === "minimize") {
      window.minimize();
      return;
    }
    if (action === "toggle-maximize") {
      if (window.isMaximized()) {
        window.unmaximize();
        this.emitWindowState(window);
        return;
      }
      window.maximize();
      this.emitWindowState(window);
      return;
    }
    window.close();
  };

  private createWindowStateSnapshot = (window: BrowserWindow | null): DesktopWindowStateSnapshot => ({
    isMaximized: Boolean(window && !window.isDestroyed() && window.isMaximized())
  });

  private emitWindowState = (window: BrowserWindow): void => {
    if (window.isDestroyed()) {
      return;
    }
    window.webContents.send(DESKTOP_WINDOW_STATE_CHANGED_CHANNEL, this.createWindowStateSnapshot(window));
  };
}

function isDesktopWindowControlAction(value: unknown): value is DesktopWindowControlAction {
  return value === "minimize" || value === "toggle-maximize" || value === "close";
}

import { ipcMain } from "electron";
import {
  DESKTOP_RUNTIME_RESTART_APP_CHANNEL,
  DESKTOP_RUNTIME_RESTART_SERVICE_CHANNEL
} from "../utils/desktop-ipc.utils";
import {
  drainDesktopCleanups,
  removeDesktopIpcHandlers,
  type DesktopCleanup
} from "../utils/desktop-lifecycle.utils";

type DesktopRuntimeControlLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
};

type DesktopRuntimeControlServiceOptions = {
  logger: DesktopRuntimeControlLogger;
  restartRuntime: () => Promise<void>;
  restartApplication: () => void;
};

export class DesktopRuntimeControlService {
  private readonly cleanups: DesktopCleanup[] = [];

  constructor(private readonly options: DesktopRuntimeControlServiceOptions) {}

  start = (): void => {
    this.dispose();
    ipcMain.removeHandler(DESKTOP_RUNTIME_RESTART_SERVICE_CHANNEL);
    ipcMain.removeHandler(DESKTOP_RUNTIME_RESTART_APP_CHANNEL);

    ipcMain.handle(DESKTOP_RUNTIME_RESTART_SERVICE_CHANNEL, async () => {
      this.options.logger.info("Desktop runtime service restart requested from renderer.");
      await this.options.restartRuntime();
      return {
        accepted: true,
        action: "restart-service" as const,
        lifecycle: "restarting-service" as const,
        message: "NextClaw service restarted."
      };
    });

    ipcMain.handle(DESKTOP_RUNTIME_RESTART_APP_CHANNEL, async () => {
      this.options.logger.info("Desktop app restart requested from renderer.");
      setTimeout(() => {
        this.options.restartApplication();
      }, 50);
      return {
        accepted: true,
        action: "restart-app" as const,
        lifecycle: "restarting-app" as const,
        message: "NextClaw app restart scheduled."
      };
    });
    this.cleanups.push(removeDesktopIpcHandlers(DESKTOP_RUNTIME_RESTART_SERVICE_CHANNEL, DESKTOP_RUNTIME_RESTART_APP_CHANNEL));
  };

  dispose = (): void => {
    drainDesktopCleanups(this.cleanups);
  };
}

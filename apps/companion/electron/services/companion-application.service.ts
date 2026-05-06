import { app } from "electron";
import { resolve } from "node:path";

import type { CompanionAppOptions } from "../types/companion-shell.types.js";
import { CompanionRuntimeStatePersistenceService } from "./companion-runtime-state-persistence.service.js";
import { CompanionTrayService } from "./companion-tray.service.js";
import { CompanionWindowPositionPersistenceService } from "./companion-window-position-persistence.service.js";
import { CompanionWindowService } from "./companion-window.service.js";

export class CompanionApplicationService {
  private readonly runtimeStatePersistenceService: CompanionRuntimeStatePersistenceService | null;
  private readonly windowService: CompanionWindowService;
  private readonly trayService: CompanionTrayService;
  private quitting = false;

  constructor(private readonly options: CompanionAppOptions) {
    this.runtimeStatePersistenceService = options.runtimeStatePath
      ? new CompanionRuntimeStatePersistenceService(options.runtimeStatePath)
      : null;
    this.windowService = new CompanionWindowService({
      preloadPath: resolve(__dirname, "..", "preload.js"),
      rendererEntryPath: resolve(__dirname, "..", "..", "ui", "index.html"),
      positionPersistenceService: CompanionWindowPositionPersistenceService.fromUserData(app.getPath("userData")),
      baseUrl: options.baseUrl,
      onQuit: () => this.quit()
    });
    this.trayService = new CompanionTrayService(
      options.baseUrl,
      () => this.windowService.toggleVisibility(),
      () => this.quit()
    );
  }

  readonly run = async (): Promise<void> => {
    if (!app.requestSingleInstanceLock()) {
      app.quit();
      return;
    }

    app.on("second-instance", () => {
      this.windowService.show();
    });
    app.on("window-all-closed", () => undefined);
    app.on("before-quit", () => {
      this.quitting = true;
      this.trayService.destroy();
      this.windowService.destroy();
      this.runtimeStatePersistenceService?.clear();
    });
    app.on("activate", () => {
      this.windowService.show();
    });

    await app.whenReady();
    this.runtimeStatePersistenceService?.write({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      baseUrl: this.options.baseUrl
    });
    await this.windowService.create();
    this.windowService.show();
    this.trayService.create();
  };

  readonly quit = (): void => {
    if (this.quitting) {
      return;
    }
    this.quitting = true;
    app.quit();
  };
}

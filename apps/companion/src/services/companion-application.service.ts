import { app } from "electron";
import { resolve } from "node:path";
import type { CompanionAppOptions } from "../types/companion.types.js";
import { CompanionRuntimeStateStore } from "../stores/companion-runtime-state.store.js";
import { CompanionWindowPositionStore } from "../stores/companion-window-position.store.js";
import { CompanionRuntimeClientService } from "./companion-runtime-client.service.js";
import { CompanionTrayService } from "./companion-tray.service.js";
import { CompanionWindowService } from "./companion-window.service.js";

export class CompanionApplicationService {
  private readonly runtimeClient: CompanionRuntimeClientService;
  private readonly runtimeStateStore: CompanionRuntimeStateStore | null;
  private readonly windowService: CompanionWindowService;
  private readonly trayService: CompanionTrayService;
  private quitting = false;

  constructor(private readonly options: CompanionAppOptions) {
    const preloadPath = resolve(__dirname, "..", "preload", "index.js");
    this.runtimeClient = new CompanionRuntimeClientService(options.baseUrl);
    this.runtimeStateStore = options.runtimeStatePath
      ? new CompanionRuntimeStateStore(options.runtimeStatePath)
      : null;
    this.windowService = new CompanionWindowService(
      preloadPath,
      CompanionWindowPositionStore.fromUserData(app.getPath("userData"))
    );
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
      this.runtimeClient.stop();
      this.trayService.destroy();
      this.windowService.destroy();
      this.runtimeStateStore?.clear();
    });
    app.on("activate", () => {
      this.windowService.show();
    });

    await app.whenReady();
    this.runtimeStateStore?.write({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      baseUrl: this.options.baseUrl
    });
    await this.windowService.create();
    this.windowService.show();
    this.trayService.create();
    await this.runtimeClient.start((view) => {
      this.windowService.updateView(view);
    });
  };

  readonly quit = (): void => {
    if (this.quitting) {
      return;
    }
    this.quitting = true;
    app.quit();
  };
}

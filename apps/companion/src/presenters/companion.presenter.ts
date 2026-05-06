import { CompanionRuntimeManager } from "../managers/companion-runtime.manager.js";
import { CompanionShellManager } from "../managers/companion-shell.manager.js";

export class CompanionPresenter {
  readonly companionRuntimeManager = new CompanionRuntimeManager();
  readonly companionShellManager = new CompanionShellManager();
  private bootstrapPromise: Promise<void> | null = null;
  private bootstrapped = false;

  readonly bootstrap = async (): Promise<void> => {
    if (this.bootstrapped) {
      return;
    }
    if (this.bootstrapPromise) {
      return await this.bootstrapPromise;
    }
    this.bootstrapPromise = (async () => {
      const shellSnapshot = await this.companionShellManager.bootstrap();
      await this.companionRuntimeManager.start(shellSnapshot.baseUrl);
      this.bootstrapped = true;
    })();
    try {
      await this.bootstrapPromise;
    } finally {
      this.bootstrapPromise = null;
    }
  };

  readonly shutdown = (): void => {
    this.companionRuntimeManager.stop();
    this.bootstrapped = false;
    this.bootstrapPromise = null;
  };
}

export const companionPresenter = new CompanionPresenter();
